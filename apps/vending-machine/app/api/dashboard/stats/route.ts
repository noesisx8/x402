import { NextRequest, NextResponse } from "next/server";
import {
  getBlockchainSettlements,
  getBlockchainStats,
  blockchainConfigured,
} from "@/lib/blockchain/base-scan";
import { getAnalyticsSummary, getRecentAnalytics, getPersistedSettlements } from "@/lib/analytics";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv, CAIP_NETWORK } from "@/lib/env";
import { GLOBAL_MAX_PRICE_USD } from "@/lib/pricing";
import { UNPAID_LIMIT, UNPAID_WINDOW_MS } from "@/lib/rate-limit";

function authorized(request: NextRequest): boolean {
  const token = serverEnv.ANALYTICS_TOKEN?.trim();
  if (!token) return false;
  const hdr = request.headers.get("authorization") ?? "";
  if (hdr === `Bearer ${token}`) return true;
  const q = request.nextUrl.searchParams.get("token");
  return q === token;
}

export const dynamic = "force-dynamic";

/**
 * Full dashboard stats API.
 * Combines in-memory analytics + on-chain blockchain data (when configured).
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "unauthorized", hint: "Pass ?token=ANALYTICS_TOKEN or Authorization: Bearer <token>" },
      { status: 401 },
    );
  }

  const [analyticsSummary, recentCalls, persistedSettlements, blockchainStats, blockchainSettlements] =
    await Promise.all([
      Promise.resolve(getAnalyticsSummary()),
      Promise.resolve(getRecentAnalytics(100)),
      getPersistedSettlements(50),
      getBlockchainStats(),
      getBlockchainSettlements(20),
    ]);

  /**
   * Cross-isolate data source: on Vercel each API route runs in its own
   * function instance, so the in-memory ring buffer only ever shows a
   * fraction of traffic. When Redis is configured, the persisted settlement
   * list (200_delivered events, shared across isolates) is the source of
   * truth for recent calls, revenue, hourly activity, and per-service
   * breakdown. Falls back to the local buffer when Redis is absent.
   */
  const analyticsSource = persistedSettlements !== null ? "redis" : "memory";
  const callsForStats: Array<{ event: string; slug: string; ms?: number; at: string }> =
    persistedSettlements !== null
      ? persistedSettlements.map((r) => ({
          event: "200_delivered",
          slug: r.slug,
          ms: r.ms ?? undefined,
          at: r.at,
        }))
      : recentCalls;

  // Revenue (price * successful deliveries)
  const priceBySlug = new Map(VENDING_SERVICES.map((s) => [s.slug, s.price]));
  let estimatedRevenue = 0;
  for (const call of callsForStats) {
    if (call.event === "200_delivered") {
      const priceStr = priceBySlug.get(call.slug);
      if (priceStr) {
        const match = priceStr.match(/\$?(\d+(?:\.\d+)?)/);
        if (match) estimatedRevenue += Number(match[1]);
      }
    }
  }

  // Build hourly bucket for sparkline (last 24h)
  const now = Date.now();
  const hourly = new Array(24).fill(0);
  for (const call of callsForStats) {
    const hoursAgo = Math.floor((now - new Date(call.at).getTime()) / 3600000);
    if (hoursAgo >= 0 && hoursAgo < 24) {
      hourly[23 - hoursAgo] += 1;
    }
  }

  // Service breakdown
  const bySlug: Record<string, { calls: number; revenue: number; price: string | null }> = {};
  for (const call of callsForStats) {
    if (!bySlug[call.slug]) {
      bySlug[call.slug] = { calls: 0, revenue: 0, price: priceBySlug.get(call.slug) ?? null };
    }
    bySlug[call.slug].calls += 1;
    if (call.event === "200_delivered") {
      const priceStr = priceBySlug.get(call.slug);
      if (priceStr) {
        const match = priceStr.match(/\$?(\d+(?:\.\d+)?)/);
        if (match) bySlug[call.slug].revenue += Number(match[1]);
      }
    }
  }

  return NextResponse.json({
    network: {
      mode: serverEnv.X402_NETWORK_MODE,
      caip: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
      payTo: serverEnv.X402_PAY_TO_ADDRESS,
      blockchainConfigured: blockchainConfigured(),
    },
    caps: {
      maxPriceUsd: GLOBAL_MAX_PRICE_USD,
      unpaidRateLimit: UNPAID_LIMIT,
      unpaidWindowMs: UNPAID_WINDOW_MS,
    },
    services: {
      total: VENDING_SERVICES.filter((s) => s.enabled).length,
      list: VENDING_SERVICES.filter((s) => s.enabled).map((s) => ({
        slug: s.slug,
        name: s.name,
        price: s.price,
        category: s.category ?? "atom",
      })),
    },
    analytics: {
      source: analyticsSource,
      summary: analyticsSummary,
      // Cross-isolate count of successful paid deliveries (Redis-backed
      // when configured) — the isolate-local summary buffer is not a
      // reliable global counter on serverless.
      paidDeliveries: callsForStats.filter((c) => c.event === "200_delivered").length,
      recentCalls: callsForStats.slice(0, 50),
      estimatedRevenue: estimatedRevenue.toFixed(6),
      hourlyActivity: hourly,
      bySlug,
    },
    blockchain: {
      ...blockchainStats,
      recentSettlements: blockchainSettlements,
    },
  });
}
