import { NextResponse } from "next/server";
import { getPersistedSettlements, getRecentAnalytics } from "@/lib/analytics";
import { VENDING_SERVICES } from "@/lib/services/registry";

export const dynamic = "force-dynamic";

/**
 * Public, privacy-safe recent-settlements feed for the homepage ticker.
 * Only successful paid deliveries are exposed: slug, latency, and timestamp.
 * No payer hints, no user agents, no 402 spam, no payment payloads.
 *
 * Source: shared Redis store (cross-function, cross-isolate) when
 * KV_REST_API_URL / UPSTASH_REDIS_REST_* are configured; otherwise falls back
 * to this isolate's in-memory ring buffer.
 */
export async function GET() {
  const priceBySlug = new Map(VENDING_SERVICES.map((s) => [s.slug, s.price]));

  const persisted = await getPersistedSettlements(20);

  const settlements = persisted
    ? persisted.map((e) => ({ ...e, price: priceBySlug.get(e.slug) ?? null }))
    : getRecentAnalytics(500)
        .filter((e) => e.event === "200_delivered")
        .slice(0, 20)
        .map((e) => ({
          slug: e.slug,
          price: priceBySlug.get(e.slug) ?? null,
          ms: e.ms ?? null,
          at: e.at,
        }));

  return NextResponse.json(
    {
      source: persisted ? "redis" : "isolate-memory",
      isolate_note: persisted
        ? "Recent paid calls across all edge isolates (shared store)."
        : "Recent paid calls observed by this edge isolate only; configure KV_REST_API_* for a global feed.",
      count: settlements.length,
      settlements,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
