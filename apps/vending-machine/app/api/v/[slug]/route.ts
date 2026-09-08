import { validInput, validOutput } from "@/lib/services/validation";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { getResourceServer } from "@/lib/x402/resource-server";
import { SERVICES_BY_SLUG } from "@/lib/services/registry";
import { serviceRouteConfig } from "@/lib/services/types";
import {
  logCall,
  payerHintFromPaymentHeader,
  userAgentHint,
} from "@/lib/analytics";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { serviceFailure } from "@/lib/services/errors";
import { encodePaymentResponseHeader } from "@x402/core/http";
import { getReceiptStore } from "@/lib/x402/receipt-store";
import { RECEIPT_HEADER, ReceiptError, ReceiptSession, receiptContext, receiptRecord, recoverReceipt } from "@/lib/x402/receipts";

/** Kronos + multi-leg bundles need headroom; Pro default allows up to 60s. */
export const maxDuration = 60;
export const runtime = "nodejs";

type Wrapped = (request: NextRequest) => Promise<NextResponse>;

const wrappedHandlers: Record<string, Wrapped> = {};

function paymentHeader(request: NextRequest): string | null {
  return (
    request.headers.get("payment-signature") ??
    request.headers.get("PAYMENT-SIGNATURE") ??
    request.headers.get("x-payment") ??
    request.headers.get("X-PAYMENT")
  );
}

async function ensureWrapped(slug: string): Promise<Wrapped | null> {
  const svc = SERVICES_BY_SLUG[slug];
  if (!svc) return null;
  if (wrappedHandlers[slug]) return wrappedHandlers[slug];

  const server = await getResourceServer();
  const inner = async (request: NextRequest): Promise<NextResponse> => {
    const started = Date.now();
    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    try {
      const receipt = receiptContext.getStore();
      // The wrapper has verified payment before entering this handler.
      if (receipt) await receipt.claim();
      const body = await svc.handler(request, query);
      const result = { service: slug, ok: true, ...body };
      if (!validOutput(svc, result)) throw new Error("service_output_mismatch");
      if (receipt) await receipt.prepare(JSON.stringify(result));
      await logCall({
        event: "handler_ok",
        slug,
        ms: Date.now() - started,
        status: 200,
      });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      await receiptContext.getStore()?.failed();
      if (e instanceof ReceiptError) return NextResponse.json({ error: e.code }, { status: e.status });
      const failure = serviceFailure(e);
      await logCall({
        event: "handler_fail",
        slug,
        ms: Date.now() - started,
        status: failure.status,
        error: failure.error,
      });
      // status >= 400 → withX402 skips settle (idempotent: no charge on bad input)
      return NextResponse.json(
        { service: slug, ok: false, error: failure.error, retryable: failure.retryable },
        { status: failure.status },
      );
    }
  };

  wrappedHandlers[slug] = withX402(inner, serviceRouteConfig(svc), server) as unknown as Wrapped;
  return wrappedHandlers[slug];
}

/**
 * Dynamic vending route: x402 flow is 402 → pay → retry → verify/settle → 200.
 * Settlement runs only after handler returns status < 400 (withX402 guarantee).
 *
 * Phase 0: rate-limit unpaid probes, structured lifecycle logs, price cap via registry.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const started = Date.now();
  const { slug } = await ctx.params;
  const ua = userAgentHint(request.headers.get("user-agent"));
  const payHdr = paymentHeader(request);
  const hasPayment = Boolean(payHdr);
  const payerHint = payerHintFromPaymentHeader(payHdr);

  if (!SERVICES_BY_SLUG[slug]) {
    return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
  }

  // Baseline applies before verification: arbitrary payment headers cannot bypass it.
  {
    const ip = clientIpFromHeaders(request.headers);
    const baseline = checkRateLimit(`requests:${ip}`, 120, 60_000);
    const rl = baseline.allowed && !hasPayment
      ? checkRateLimit(`unpaid:${ip}:${slug}`)
      : baseline;
    if (!rl.allowed) {
      await logCall({
        event: "rate_limited",
        slug,
        status: 429,
        ms: Date.now() - started,
        userAgentHint: ua,
      });
      return NextResponse.json(
        { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  }
  if (hasPayment) {
    await logCall({
      event: "payment_present",
      slug,
      userAgentHint: ua,
      payerHint,
    });
  }

  const query = Object.fromEntries(new URL(request.url).searchParams);
  if (!validInput(SERVICES_BY_SLUG[slug], query)) return NextResponse.json({ error: "invalid_request", retryable: false }, { status: 400 });

  try {
    let receipt: ReceiptSession | undefined;
    const token = request.headers.get(RECEIPT_HEADER);
    if (token && payHdr) {
      const store = getReceiptStore();
      if (!store) throw new ReceiptError("receipt_storage_unavailable");
      const record = receiptRecord(token, payHdr, request.url);
      const existing = await store.get(record.id);
      if (existing) {
        if (existing.binding !== record.binding) throw new ReceiptError("receipt_binding_mismatch", 409);
        const recovered = await recoverReceipt(store, record.id);
        const headers: Record<string, string> = { "Cache-Control": "no-store", "X-VendSDK-Recovered": "true" };
        if (recovered.status === 200 && existing.transaction) headers["PAYMENT-RESPONSE"] = encodePaymentResponseHeader({ success: true, transaction: existing.transaction, network: existing.network as `eip155:${number}`, payer: existing.payer });
        return NextResponse.json(recovered.status === 200 ? recovered.body.result : recovered.body, { status: recovered.status, headers });
      }
      receipt = new ReceiptSession(store, record);
    }
    const handler = await ensureWrapped(slug);
    if (!handler) {
      return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
    }
    const res = receipt ? await receiptContext.run(receipt, () => handler(request)) : await handler(request);
    res.headers.set("Cache-Control", "no-store");
    if (receipt) res.headers.set("X-VendSDK-Receipt-Status", "/api/receipts");
    const ms = Date.now() - started;

    if (res.status === 402) {
      await logCall({
        event: "402_issued",
        slug,
        status: 402,
        ms,
        userAgentHint: ua,
      });
    } else if (res.status === 200) {
      await logCall({
        event: "200_delivered",
        slug,
        status: 200,
        ms,
        userAgentHint: ua,
        payerHint,
      });
      // Settlement is performed inside withX402 after handler success
      if (hasPayment) {
        await logCall({
          event: "settlement_response",
          slug,
          status: 200,
          ms,
          payerHint,
        });
      }
    } else if (res.status >= 500) {
      await logCall({
        event: "error",
        slug,
        status: res.status,
        ms,
        userAgentHint: ua,
        error: `upstream_status_${res.status}`,
      });
    }

    return res;
  } catch (e) {
    if (e instanceof ReceiptError) return NextResponse.json({ error: e.code }, { status: e.status, headers: { "Cache-Control": "no-store" } });
    await logCall({
      event: "error",
      slug,
      status: 502,
      ms: Date.now() - started,
      userAgentHint: ua,
      payerHint,
      error: "payment_pipeline_failed",
    });
    return NextResponse.json(
      { error: "facilitator_or_server_error", message: "payment pipeline failed" },
      { status: 502 },
    );
  }
}
