import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serviceApiPath } from "@/lib/services/types";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

/** MCP / agent discovery catalog */
export async function GET() {
  const base = serverEnv.PUBLIC_BASE_URL ?? "";
  return NextResponse.json({
    version: 1,
    protocol: "x402",
    x402_version: 2,
    network_mode: serverEnv.X402_NETWORK_MODE,
    caip_network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    pay_to: serverEnv.X402_PAY_TO_ADDRESS,
    facilitator: serverEnv.X402_FACILITATOR_URL,
    services: VENDING_SERVICES.filter((s) => s.enabled).map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      price_usdc_hint: s.price,
      scheme: s.scheme,
      method: "GET",
      url: base ? `${base}${serviceApiPath(s.slug)}` : serviceApiPath(s.slug),
      query_params: s.queryParams,
    })),
  });
}