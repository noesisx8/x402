/**
 * Agent-hot utilities: safe fetch, text extract, Base chain reads.
 * All fail closed; SSRF guards reuse infra helpers.
 */

import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from "viem";
import { base } from "viem/chains";
import { normalizeHost } from "@/lib/services/infra";
import { assertPublicUrl, publicHttp } from "@x402-project/request-guard";

/** Same public-URL rules as the shared guard (port allowlist, private ranges, suffixes). */
export function assertPublicHttpUrl(raw: string): URL {
  return assertPublicUrl(raw);
}

/** Strip tags / collapse whitespace for agent-readable text. */
export function htmlToText(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return t.replace(/\s+/g, " ").trim();
}

export type HttpGetResult = {
  url: string;
  final_url: string;
  status: number;
  ok: boolean;
  ms: number;
  content_type: string | null;
  bytes: number;
  truncated: boolean;
  body_text: string | null;
  body_json: unknown | null;
};

const MAX_BODY = 48_000; // ~48KB agent-friendly cap

export async function safeHttpGet(urlRaw: string, maxBytes = MAX_BODY): Promise<HttpGetResult> {
  const result = await publicHttp(urlRaw, "GET", {
    maxHops: 5,
    maxBytes,
    timeoutMs: 8_000,
    headers: {
      "User-Agent": "x402-vending-machine/0.2 (+agent-fetch)",
      Accept: "text/html,application/json,text/plain,*/*",
    },
  });
  const truncated = result.truncated;
  const ct = result.headers.get("content-type") ?? "";
  const text = new TextDecoder("utf-8", { fatal: false }).decode(result.body);

  let body_json: unknown | null = null;
  let body_text: string | null = text;
  if (ct.includes("application/json")) {
    try {
      body_json = JSON.parse(text);
      body_text = null;
    } catch {
      body_json = null;
    }
  }

  return {
    url: result.url,
    final_url: result.finalUrl,
    status: result.status,
    ok: result.status >= 200 && result.status < 300,
    ms: result.ms,
    content_type: ct || null,
    bytes: result.body.byteLength,
    truncated,
    body_text,
    body_json,
  };
}

export async function fetchPageText(urlRaw: string, maxChars = 12_000): Promise<{
  url: string;
  final_url: string;
  status: number;
  ms: number;
  title: string | null;
  text: string;
  chars: number;
  truncated: boolean;
}> {
  const got = await safeHttpGet(urlRaw, 200_000);
  if (got.status >= 400) throw new Error(`upstream_${got.status}`);
  const raw = got.body_text ?? (got.body_json ? JSON.stringify(got.body_json) : "");
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? htmlToText(titleMatch[1]).slice(0, 200) : null;
  const isHtml = (got.content_type ?? "").includes("html") || /<html/i.test(raw);
  const full = isHtml ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim();
  const truncated = full.length > maxChars;
  return {
    url: got.url,
    final_url: got.final_url,
    status: got.status,
    ms: got.ms,
    title,
    text: truncated ? full.slice(0, maxChars) : full,
    chars: Math.min(full.length, maxChars),
    truncated,
  };
}

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

function baseClient() {
  const rpc = process.env.BASE_RPC_URL?.trim() || "https://mainnet.base.org";
  return createPublicClient({ chain: base, transport: http(rpc, { timeout: 8_000 }) });
}

export async function baseWalletSnapshot(addressRaw: string): Promise<{
  address: string;
  chain: "base";
  chain_id: number;
  eth: string;
  usdc: string;
  block_number: string;
  source: string;
  ms: number;
}> {
  const address = addressRaw.trim();
  if (!isAddress(address)) throw new Error("invalid_address");
  const started = Date.now();
  const client = baseClient();
  let ethWei: bigint;
  let usdcRaw: bigint;
  let block: bigint;
  try {
    [ethWei, usdcRaw, block] = await Promise.all([
      client.getBalance({ address: address as Address }),
      client.readContract({
        address: USDC_BASE,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as Address],
      }),
      client.getBlockNumber(),
    ]);
  } catch {
    throw new Error("base_rpc_failed");
  }
  return {
    address,
    chain: "base",
    chain_id: base.id,
    eth: formatEther(ethWei),
    usdc: formatUnits(usdcRaw, 6),
    block_number: block.toString(),
    source: "base-mainnet-rpc",
    ms: Date.now() - started,
  };
}

export async function resolveDnsRecords(
  hostRaw: string,
  typesRaw?: string,
): Promise<{
  host: string;
  records: Record<string, string[]>;
  source: "doh";
  ms: number;
}> {
  const host = normalizeHost(hostRaw);
  const types = (typesRaw ?? "A,AAAA,MX,TXT,NS")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => ["A", "AAAA", "MX", "TXT", "NS", "CNAME"].includes(t))
    .slice(0, 6);
  if (types.length === 0) throw new Error("invalid_types");

  const started = Date.now();
  const records: Record<string, string[]> = {};
  await Promise.all(
    types.map(async (type) => {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`doh_${type}_${res.status}`);
      const j = (await res.json()) as { Answer?: { type: number; data: string }[] };
      const typeNum: Record<string, number> = {
        A: 1,
        AAAA: 28,
        MX: 15,
        TXT: 16,
        NS: 2,
        CNAME: 5,
      };
      const want = typeNum[type];
      records[type] = (j.Answer ?? [])
        .filter((a) => a.type === want)
        .map((a) => a.data.replace(/\.$/, "").replace(/^"|"$/g, ""));
    }),
  );

  return { host, records, source: "doh", ms: Date.now() - started };
}
