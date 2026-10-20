import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsSummary, getRecentAnalytics } from "@/lib/analytics";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv, CAIP_NETWORK } from "@/lib/env";
import { GLOBAL_MAX_PRICE_USD } from "@/lib/pricing";
import {
  PAID_IP_LIMIT,
  PAID_PAYER_LIMIT,
  PAID_WINDOW_MS,
  PAYER_FAIL_LIMIT,
  PAYMENT_MAX_USES,
  UNPAID_LIMIT,
  UNPAID_WINDOW_MS,
} from "@/lib/rate-limit";

function authorized(request: NextRequest): boolean {
  const token = serverEnv.ANALYTICS_TOKEN?.trim();
  // If no token configured, expose only a minimal public health snapshot (no call log)
  if (!token) return false;
  const hdr = request.headers.get("authorization") ?? "";
  if (hdr === `Bearer ${token}`) return true;
  const q = request.nextUrl.searchParams.get("token");
  return q === token;
}

export async function GET(request: NextRequest) {
  const base = {
    network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    network_mode: serverEnv.X402_NETWORK_MODE,
    services: VENDING_SERVICES.filter((s) => s.enabled).length,
    caps: {
      max_price_usd: GLOBAL_MAX_PRICE_USD,
      unpaid_rate_limit: UNPAID_LIMIT,
      unpaid_window_ms: UNPAID_WINDOW_MS,
      paid_ip_rate_limit: PAID_IP_LIMIT,
      paid_payer_rate_limit: PAID_PAYER_LIMIT,
      paid_window_ms: PAID_WINDOW_MS,
      payment_max_uses: PAYMENT_MAX_USES,
      payer_fail_limit: PAYER_FAIL_LIMIT,
    },
  };

  if (!authorized(request)) {
    // Public: no recent_calls (avoids leaking traffic patterns)
    return NextResponse.json({
      ...base,
      auth: "set ANALYTICS_TOKEN and pass Authorization: Bearer <token> for full stats",
    });
  }

  return NextResponse.json({
    ...base,
    summary: getAnalyticsSummary(),
    recent_calls: getRecentAnalytics(50),
  });
}
