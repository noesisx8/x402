import { NextRequest, NextResponse } from "next/server";
import { getBlockchainSettlements, blockchainConfigured } from "@/lib/blockchain/base-scan";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Truncate an address to 0x1234…abcd form — payer privacy in the public feed. */
function truncateAddress(addr: string): string {
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/**
 * Public blockchain settlement feed (no auth required).
 * Returns verified on-chain USDC transfers to the settlement address.
 * Privacy: payer (`from`) addresses are truncated, matching the
 * "no payer hints in public feeds" policy used by the Redis ticker.
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "20"), 100);

  if (!blockchainConfigured()) {
    return NextResponse.json(
      {
        source: "not-configured",
        note: "Set BASESCAN_API_KEY and a real X402_PAY_TO_ADDRESS to enable on-chain settlement tracking.",
        settlements: [],
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const settlements = (await getBlockchainSettlements(limit)).map((s) => ({
    ...s,
    from: truncateAddress(s.from),
  }));

  return NextResponse.json(
    {
      source: "basescan",
      network: "base",
      payTo: serverEnv.X402_PAY_TO_ADDRESS,
      count: settlements.length,
      settlements,
    },
    { headers: { "cache-control": "max-age=30" } },
  );
}
