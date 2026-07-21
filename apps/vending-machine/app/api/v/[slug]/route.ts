import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { getResourceServer } from "@/lib/x402/resource-server";
import { getPaywallProvider, paywallConfig } from "@/lib/x402/paywall";
import { SERVICES_BY_SLUG } from "@/lib/services/registry";
import { serviceRouteConfig } from "@/lib/services/types";
import {
  logCall,
  payerHintFromPaymentHeader,
  userAgentHint,
} from "@/lib/analytics";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

/** Kronos + multi-leg bundles need headroom; Pro default allows up to 60s. */
export const maxDuration = 60;
export const runtime = "nodejs";

type Wrapped = (request: NextRequest) => Promise<NextResponse>;

const wrappedHandlers: Record<string, Wrapped> = {};
const requestIds = new WeakMap<NextRequest, string>();
const handlerDurations = new WeakMap<NextRequest, number>();

function paymentHeader(request: NextRequest): string | null {
  return (
    request.headers.get("payment-signature") ??
    request.headers.get("PAYMENT-SIGNATURE") ??
    request.headers.get("x-payment") ??
    request.headers.get("X-PAYMENT")
  );
}

function requestIdFor(request: NextRequest): string {
  return (
    requestIds.get(request) ??
    request.headers.get("x-vercel-id") ??
    request.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}

async function ensureWrapped(slug: string): Promise<Wrapped | null> {
  const svc = SERVICES_BY_SLUG[slug];
  if (!svc) return null;
  if (wrappedHandlers[slug]) return wrappedHandlers[slug];

  const server = await getResourceServer();
  const inner = async (request: NextRequest) => {
    const started = Date.now();
    const requestId = requestIdFor(request);
    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    try {
      const body = await svc.handler(request, query);
      const handlerMs = Date.now() - started;
      handlerDurations.set(request, handlerMs);
      await logCall({
        event: "handler_ok",
        slug,
        ms: handlerMs,
        status: 200,
        requestId,
      });
      return NextResponse.json({ service: slug, ok: true, ...body });
    } catch (e) {
      const handlerMs = Date.now() - started;
      handlerDurations.set(request, handlerMs);
      await logCall({
        event: "handler_fail",
        slug,
        ms: handlerMs,
        status: 400,
        error: String(e).slice(0, 200),
        requestId,
      });
      // status >= 400 → withX402 skips settle (idempotent: no charge on bad input)
      return NextResponse.json(
        { service: slug, ok: false, error: String(e) },
        { status: 400 },
      );
    }
  };

  wrappedHandlers[slug] = withX402(
    inner,
    serviceRouteConfig(svc),
    server,
    paywallConfig(`/api/v/${slug}`),
    getPaywallProvider(),
  ) as unknown as Wrapped;
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
  const requestId = requestIdFor(request);
  requestIds.set(request, requestId);
  const { slug } = await ctx.params;
  const ua = userAgentHint(request.headers.get("user-agent"));
  const payHdr = paymentHeader(request);
  const hasPayment = Boolean(payHdr);
  const payerHint = payerHintFromPaymentHeader(payHdr);

  if (!SERVICES_BY_SLUG[slug]) {
    return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
  }

  // Phase 0.5 — throttle unpaid 402 spam (per IP + slug, per isolate)
  if (!hasPayment) {
    const ip = clientIpFromHeaders(request.headers);
    const rl = checkRateLimit(`unpaid:${ip}:${slug}`);
    if (!rl.allowed) {
      await logCall({
        event: "rate_limited",
        slug,
        status: 429,
        ms: Date.now() - started,
        userAgentHint: ua,
        requestId,
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
  } else {
    await logCall({
      event: "payment_present",
      slug,
      userAgentHint: ua,
      payerHint,
      requestId,
    });
  }

  const prepareStarted = Date.now();
  const handler = await ensureWrapped(slug);
  const resourceInitMs = Date.now() - prepareStarted;
  if (!handler) {
    return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
  }

  if (resourceInitMs > 5 || hasPayment) {
    await logCall({
      event: "resource_server_ready",
      slug,
      ms: resourceInitMs,
      requestId,
    });
  }

  try {
    const res = await handler(request);
    const ms = Date.now() - started;

    if (res.status === 402) {
      await logCall({
        event: "402_issued",
        slug,
        status: 402,
        ms,
        userAgentHint: ua,
        requestId,
      });
    } else if (res.status === 200) {
      const handlerMs = handlerDurations.get(request);
      const paymentOverheadMs =
        hasPayment && handlerMs !== undefined ? Math.max(0, ms - handlerMs) : undefined;
      await logCall({
        event: "200_delivered",
        slug,
        status: 200,
        ms,
        userAgentHint: ua,
        payerHint,
        requestId,
        handlerMs,
        paymentOverheadMs,
      });
      // Settlement is performed inside withX402 after handler success
      if (hasPayment) {
        await logCall({
          event: "payment_pipeline_complete",
          slug,
          status: 200,
          ms,
          payerHint,
          requestId,
          handlerMs,
          paymentOverheadMs,
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
        requestId,
      });
    }

    return res;
  } catch (e) {
    await logCall({
      event: "error",
      slug,
      status: 502,
      ms: Date.now() - started,
      userAgentHint: ua,
      payerHint,
      error: String(e).slice(0, 200),
      requestId,
    });
    return NextResponse.json(
      { error: "facilitator_or_server_error", message: "payment pipeline failed" },
      { status: 502 },
    );
  }
}
