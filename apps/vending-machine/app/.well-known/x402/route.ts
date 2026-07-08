import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    version: 2,
    name: "x402-vending-machine",
    description: "Modular pay-per-call utilities for AI agents",
    network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    endpoints: VENDING_SERVICES.filter((s) => s.enabled).map((s) => ({
      path: `/api/v/${s.slug}`,
      scheme: s.scheme,
      priceHint: s.price.replace("$", ""),
      asset: "USDC",
    })),
  });
}