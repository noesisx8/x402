import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";

/**
 * Live service list for /test dropdown — always matches the registry.
 * Avoids hardcoded slug lists going stale after new SKUs ship.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const services = VENDING_SERVICES.filter((s) => s.enabled).map((s) => {
    const example = s.discovery?.exampleQuery ?? {};
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(example).map(([k, v]) => [k, String(v)]),
      ),
    ).toString();
    return {
      slug: s.slug,
      name: s.name,
      price: s.price,
      category: s.category ?? "atom",
      qs,
    };
  });

  // Bundles → premium → atoms (same as homepage)
  const rank = (c: string) => (c === "bundle" ? 0 : c === "premium" ? 1 : 2);
  services.sort((a, b) => rank(a.category) - rank(b.category) || a.slug.localeCompare(b.slug));

  return NextResponse.json(
    { services },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
