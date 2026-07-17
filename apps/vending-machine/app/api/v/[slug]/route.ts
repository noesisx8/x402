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
  const inner = async (request: NextRequest) => {
    const started = Date.now();
    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    try {
      const body = await svc.handler(request, query);
      await logCall({
        event: "handler_ok",
        slug,
        ms: Date.now() - started,
        status: 200,
      });
      return NextResponse.json({ service: slug, ok: true, ...body });
    } catch (e) {
      await logCall({
        event: "handler_fail",
        slug,
        ms: Date.now() - started,
        status: 400,
        error: String(e).slice(0, 200),
      });
      // status >= 400 → withX402 skips settle (idempotent: no charge on bad input)
      return NextResponse.json(
        { service: slug, ok: false, error: String(e) },
        { status: 400 },
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
    });
  }

  const handler = await ensureWrapped(slug);
  if (!handler) {
    return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
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
    await logCall({
      event: "error",
      slug,
      status: 502,
      ms: Date.now() - started,
      userAgentHint: ua,
      payerHint,
      error: String(e).slice(0, 200),
    });
    return NextResponse.json(
      { error: "facilitator_or_server_error", message: "payment pipeline failed" },
      { status: 502 },
    );
  }
}
