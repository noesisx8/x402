import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

export async function GET() {
  const enabled = VENDING_SERVICES.filter((s) => s.enabled);
  return NextResponse.json({
    version: 2,
    name: "x402-vending-machine",
    description:
      "Base x402 bundler hub for AI agents: multi-step packs (infra, outbound, domain intel), utilities, and Kronos research candle forecasts",
    network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    pay_to: serverEnv.X402_PAY_TO_ADDRESS,
    facilitator: serverEnv.X402_FACILITATOR_URL,
    service_count: enabled.length,
    endpoints: enabled.map((s) => ({
      path: `/api/v/${s.slug}`,
      name: s.name,
      scheme: s.scheme,
      priceHint: s.price.replace("$", ""),
      asset: "USDC",
      category: s.category ?? "atom",
      description: s.description,
      query: s.queryParams,
    })),
    docs: {
      catalog: "/.well-known/agent-services.json",
      openapi: "/api/openapi.json",
      llms: "/llms.txt",
      test: "/test",
    },
  });
}
