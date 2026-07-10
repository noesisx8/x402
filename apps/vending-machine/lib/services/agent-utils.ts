/**
 * Agent-hot utilities: safe fetch, text extract, Base chain reads.
 * All fail closed; SSRF guards reuse infra helpers.
 */

import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from "viem";
import { base } from "viem/chains";
import {
  assertPublicHostResolves,
  normalizeHost,
} from "@/lib/services/infra";

// Re-export assertPublicUrl via duplicate check — import from infra if exported
// infra has assertPublicUrl private; we validate here.

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;

export function assertPublicHttpUrl(raw: string): URL {
  const s = raw.trim();
  if (!s || s.length > 2048) throw new Error("invalid_url");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("invalid_protocol");
  if (u.username || u.password) throw new Error("url_auth_not_allowed");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("host_not_allowed");
  }
  if (PRIVATE_HOST.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    // allow public IPs only via resolve check below for hostnames
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
      const [a, b] = parts;
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        throw new Error("private_ip_not_allowed");
      }
    }
  }
  return u;
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
  const u = assertPublicHttpUrl(urlRaw);
  await assertPublicHostResolves(u.hostname);
  const started = Date.now();
  const res = await fetch(u.toString(), {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": "x402-vending-machine/0.2 (+agent-fetch)",
      Accept: "text/html,application/json,text/plain,*/*",
    },
  });
  const final = new URL(res.url);
  await assertPublicHostResolves(final.hostname).catch(() => {
    throw new Error("redirect_private_or_bad_host");
  });

  const buf = new Uint8Array(await res.arrayBuffer());
  const truncated = buf.byteLength > maxBytes;
  const slice = truncated ? buf.slice(0, maxBytes) : buf;
  const ct = res.headers.get("content-type") ?? "";
  const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);

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
    url: u.toString(),
    final_url: res.url,
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    content_type: ct || null,
    bytes: buf.byteLength,
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
  const [ethWei, usdcRaw, block] = await Promise.all([
    client.getBalance({ address: address as Address }),
    client.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    }),
    client.getBlockNumber(),
  ]);
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
