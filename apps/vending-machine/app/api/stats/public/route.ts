import { NextResponse } from "next/server";
import { getRecentAnalytics } from "@/lib/analytics";
import { VENDING_SERVICES } from "@/lib/services/registry";

export const dynamic = "force-dynamic";

/**
 * Public, privacy-safe recent-settlements feed for the homepage ticker.
 * Only successful paid deliveries are exposed: slug, latency, truncated payer
 * hint (already shortened by analytics), and timestamp. No user agents, no
 * 402 spam, no full payment payloads. In-memory per serverless isolate — the
 * feed reflects whatever this isolate has served since cold start.
 */
export async function GET() {
  const priceBySlug = new Map(VENDING_SERVICES.map((s) => [s.slug, s.price]));

  const settlements = getRecentAnalytics(500)
    .filter((e) => e.event === "200_delivered")
    .slice(0, 20)
    .map((e) => ({
      slug: e.slug,
      price: priceBySlug.get(e.slug) ?? null,
      ms: e.ms ?? null,
      payer: e.payerHint ?? null,
      at: e.at,
    }));

  return NextResponse.json(
    {
      isolate_note:
        "Recent paid calls observed by this edge isolate since cold start; not a global ledger.",
      count: settlements.length,
      settlements,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
