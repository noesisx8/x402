import { NextResponse } from "next/server";
import { CAIP_NETWORK, isPlaceholderPayTo, serverEnv } from "@/lib/env";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { shouldUseCdpFacilitatorAuth } from "@/lib/x402/cdp-auth";
import { GLOBAL_MAX_PRICE_USD } from "@/lib/pricing";

export async function GET() {
  const cdpAuth = shouldUseCdpFacilitatorAuth(
    serverEnv.X402_FACILITATOR_URL,
    serverEnv.CDP_API_KEY_ID,
    serverEnv.CDP_API_KEY_SECRET,
  );

  return NextResponse.json({
    ok: true,
    service: "x402-vending-machine",
    network_mode: serverEnv.X402_NETWORK_MODE,
    network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    services_enabled: VENDING_SERVICES.filter((s) => s.enabled).length,
    pay_to_configured: !isPlaceholderPayTo(),
    cdp_facilitator_auth: cdpAuth,
    max_price_usd: GLOBAL_MAX_PRICE_USD,
  });
}
