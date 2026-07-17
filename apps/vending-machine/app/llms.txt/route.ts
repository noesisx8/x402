import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv } from "@/lib/env";

/** Agent-oriented site map (llms.txt convention). */
export async function GET() {
  const base = serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app";
  const enabled = VENDING_SERVICES.filter((s) => s.enabled);
  const lineFor = (s: (typeof enabled)[0]) => {
    const q = s.queryParams
      .filter((p) => p.required)
      .map((p) => `${p.name}=…`)
      .join("&");
    const path = q ? `${base}/api/v/${s.slug}?${q}` : `${base}/api/v/${s.slug}`;
    return `- ${s.slug} (${s.price}): ${s.description} — GET ${path}`;
  };
  const bundles = enabled.filter((s) => (s.category ?? "atom") === "bundle");
  const premium = enabled.filter((s) => s.category === "premium");
  const atoms = enabled.filter((s) => (s.category ?? "atom") === "atom");

  const lines = [
    `# x402 Vending Machine — Base bundler hub`,
    `> Multi-step agent jobs in one exact USDC payment (x402 V2 + CDP). Bundles first; Kronos research forecasts as premium.`,
    ``,
    `Base URL: ${base}`,
    `Network: Base (eip155:8453)`,
    `Discovery: ${base}/.well-known/x402`,
    `Catalog: ${base}/.well-known/agent-services.json`,
    `OpenAPI: ${base}/api/openapi.json`,
    `Human test: ${base}/test`,
    `Payments: exact USDC micropayments; unpaid GET → HTTP 402 Payment-Required`,
    ``,
    `## Bundles (prefer these)`,
    ...bundles.map(lineFor),
    ``,
    `## Premium`,
    ...(premium.length ? premium.map(lineFor) : ["- (none enabled)"]),
    ``,
    `## Atoms`,
    ...atoms.map(lineFor),
    ``,
    `## Notes`,
    `- No API keys. Agents pay per call with USDC on Base.`,
    `- Live upstream data only; handler errors return 400 (no settle).`,
    `- Bazaar discovery enabled; listed via CDP after settle.`,
    `- Kronos outputs are research-only, not financial advice.`,
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
