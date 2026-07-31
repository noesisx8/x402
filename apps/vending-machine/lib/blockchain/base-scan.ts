/**
 * Base blockchain client — queries USDC transfers on Base via BaseScan API.
 * Falls back gracefully when no API key or placeholder address is configured.
 */

import { unstable_cache } from "next/cache";

import { serverEnv } from "@/lib/env";
import { isPlaceholderPayTo } from "@/lib/env";

const BASESCAN_API_URL = "https://api.basescan.org/api";
const USDC_CONTRACT_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY?.trim();

export type OnChainTransfer = {
  hash: string;
  from: string;
  to: string;
  value: string; // raw USDC atomic (6 decimals)
  valueFormatted: string; // human readable
  timestamp: string; // ISO
  blockNumber: string;
  gasPrice: string;
  confirmations: string;
};

export type BlockchainSettlement = {
  hash: string;
  from: string;
  to: string;
  amountUsdc: string;
  timestamp: string;
  blockNumber: number;
  confirmations: number;
};

function basescanUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams({
    module: "account",
    action: "tokentx",
    contractaddress: USDC_CONTRACT_BASE,
    address: serverEnv.X402_PAY_TO_ADDRESS,
    sort: "desc",
    ...params,
    ...(BASESCAN_API_KEY ? { apikey: BASESCAN_API_KEY } : {}),
  });
  return `${BASESCAN_API_URL}?${qs}`;
}

export function blockchainConfigured(): boolean {
  return !isPlaceholderPayTo() && Boolean(BASESCAN_API_KEY);
}

/** Raw BaseScan query — wrapped by the cached export below. */
async function queryUsdcTransfers(
  limit: number,
): Promise<{ transfers: OnChainTransfer[]; source: string }> {
  try {
    const res = await fetch(basescanUrl({ offset: String(limit) }), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`basescan_http_${res.status}`);

    const json = (await res.json()) as {
      status?: string;
      message?: string;
      result?: Array<{
        hash: string;
        from: string;
        to: string;
        value: string;
        tokenDecimal: string;
        timeStamp: string;
        blockNumber: string;
        gasPrice: string;
        confirmations: string;
      }>;
    };

    if (json.status !== "1" || !Array.isArray(json.result)) {
      // BaseScan returns status "0" with message when no txs or error
      if (json.message?.toLowerCase().includes("no transactions")) {
        return { transfers: [], source: "basescan-empty" };
      }
      throw new Error(`basescan_error: ${json.message ?? "unknown"}`);
    }

    const decimals = 6;
    const transfers: OnChainTransfer[] = json.result.map((t) => {
      const rawValue = BigInt(t.value);
      const formatted = (Number(rawValue) / 10 ** decimals).toFixed(decimals);
      return {
        hash: t.hash,
        from: t.from,
        to: t.to,
        value: t.value,
        valueFormatted: formatted,
        timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
        blockNumber: t.blockNumber,
        gasPrice: t.gasPrice,
        confirmations: t.confirmations,
      };
    });

    return { transfers, source: "basescan" };
  } catch (e) {
    // Best-effort: never break the request path
    return {
      transfers: [],
      source: `basescan-error:${String(e).slice(0, 60)}`,
    };
  }
}

/**
 * Server-side Data Cache around the BaseScan query (60 s revalidation).
 * The public ticker polls every 15 s from every visitor's browser — without
 * this, each poll would hit BaseScan directly and exhaust the free-tier
 * rate limit. Cached per `limit` argument; errors are cached too, which
 * doubles as a circuit breaker during BaseScan outages.
 */
const getCachedUsdcTransfers = unstable_cache(
  queryUsdcTransfers,
  ["basescan-usdc-transfers"],
  { revalidate: 60, tags: ["basescan-transfers"] },
);

/** Fetch recent USDC transfers to the settlement address (cached 60 s). */
export async function fetchUsdcTransfers(
  limit = 20,
): Promise<{ transfers: OnChainTransfer[]; source: string }> {
  if (isPlaceholderPayTo()) {
    return { transfers: [], source: "placeholder-address" };
  }
  return getCachedUsdcTransfers(Math.min(limit, 100));
}

/** Convert BaseScan transfers to dashboard-friendly settlements. */
export async function getBlockchainSettlements(
  limit = 20,
): Promise<BlockchainSettlement[]> {
  const { transfers } = await fetchUsdcTransfers(limit);
  return transfers.map((t) => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    amountUsdc: t.valueFormatted,
    timestamp: t.timestamp,
    blockNumber: Number(t.blockNumber),
    confirmations: Number(t.confirmations),
  }));
}

/** Aggregate stats from on-chain data. */
export async function getBlockchainStats(): Promise<{
  totalSettlements: number;
  totalUsdc: string;
  avgUsdc: string;
  latestBlock: number;
}> {
  const { transfers } = await fetchUsdcTransfers(100);

  if (transfers.length === 0) {
    return { totalSettlements: 0, totalUsdc: "0.00", avgUsdc: "0.00", latestBlock: 0 };
  }

  const totalRaw = transfers.reduce((sum, t) => sum + BigInt(t.value), BigInt(0));
  const totalUsdc = (Number(totalRaw) / 10 ** 6).toFixed(6);
  const avgUsdc = (Number(totalRaw) / transfers.length / 10 ** 6).toFixed(6);
  const latestBlock = Math.max(...transfers.map((t) => Number(t.blockNumber)));

  return {
    totalSettlements: transfers.length,
    totalUsdc,
    avgUsdc,
    latestBlock,
  };
}
