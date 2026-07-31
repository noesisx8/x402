import { NextRequest, NextResponse } from "next/server";
import { fetchUsdcTransfers, blockchainConfigured } from "@/lib/blockchain/base-scan";
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

  const { transfers, source } = await fetchUsdcTransfers(limit);
  const settlements = transfers.map((t) => ({
    hash: t.hash,
    from: truncateAddress(t.from),
    to: t.to,
    amountUsdc: t.valueFormatted,
    timestamp: t.timestamp,
    blockNumber: Number(t.blockNumber),
    confirmations: Number(t.confirmations),
  }));

  return NextResponse.json(
    {
      source,
      network: serverEnv.X402_NETWORK_MODE,
      payTo: serverEnv.X402_PAY_TO_ADDRESS,
      count: settlements.length,
      settlements,
    },
    { headers: { "cache-control": "max-age=30" } },
  );
}
