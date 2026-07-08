import { NextResponse } from "next/server";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

/** Safe client config for paid browser tests (no secrets). */
export async function GET() {
  const mode = serverEnv.X402_NETWORK_MODE;
  return NextResponse.json({
    networkMode: mode,
    caipNetwork: CAIP_NETWORK[mode],
    chainName: mode === "base" ? "Base Mainnet" : "Base Sepolia",
    hint:
      mode === "base"
        ? "Wallet must be on Base with USDC for micropayments."
        : "Wallet on Base Sepolia with test USDC.",
  });
}