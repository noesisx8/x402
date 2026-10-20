/**
 * Paid DNS and HTTP probes. Customer targets go through the shared guard:
 * internal names and private answers are rejected, and HTTP never follows
 * redirects opaquely.
 */

import * as dns from "node:dns/promises";
import { isIP } from "node:net";
import {
  assertPublicAnswers,
  assertPublicHostname,
  publicHttp,
  type PublicHttpOptions,
} from "@x402-project/request-guard";

export type DnsResolvers = {
  resolve4?: (hostname: string) => Promise<string[]>;
  resolve6?: (hostname: string) => Promise<string[]>;
};

function emptyOnMiss(error: unknown): string[] {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "ENOTFOUND" || code === "ENODATA" || code === "ENOTIMP") return [];
  throw error;
}

export async function readDns(
  hostRaw: string,
  resolvers: DnsResolvers = {},
): Promise<{ host: string; a: string[]; aaaa: string[] }> {
  const host = assertPublicHostname(hostRaw);
  if (isIP(host)) {
    assertPublicAnswers([host]);
    return host.includes(":") ? { host, a: [], aaaa: [host] } : { host, a: [host], aaaa: [] };
  }

  const resolve4 = resolvers.resolve4 ?? ((hostname: string) => dns.resolve4(hostname));
  const resolve6 = resolvers.resolve6 ?? ((hostname: string) => dns.resolve6(hostname));
  let a: string[] = [];
  let aaaa: string[] = [];
  try {
    [a, aaaa] = await Promise.all([
      resolve4(host).catch(emptyOnMiss),
      resolve6(host).catch(emptyOnMiss),
    ]);
  } catch {
    throw new Error("dns_lookup_failed");
  }
  assertPublicAnswers([...a, ...aaaa]);
  return { host, a, aaaa };
}

export async function readHttpHead(rawUrl: string, options: PublicHttpOptions = {}) {
  const result = await publicHttp(rawUrl, "HEAD", {
    fallbackGet: true,
    maxHops: 4,
    timeoutMs: 8_000,
    maxBytes: 0,
    headers: { "User-Agent": "x402-api/0.1 (+http-head)" },
    ...options,
  });
  return {
    url: result.url,
    final_url: result.finalUrl,
    status: result.status,
    ms: result.ms,
    headers: {
      "content-type": result.headers.get("content-type"),
      server: result.headers.get("server"),
    },
  };
}
