/**
 * Outbound HTTP/TLS primitives for customer-supplied destinations.
 * DNS is resolved once, every answer must be public, and the connection is
 * pinned to one validated address to prevent DNS rebinding between checks.
 */

import * as http from "node:http";
import * as https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["2001:db8::", 32],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export type PublicAddress = { address: string; family: 4 | 6 };
type LookupAll = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<{ address: string; family: number }[]>;

export type PublicResponse = {
  status: number;
  headers: Headers;
  body: Uint8Array;
  bytes: number;
  truncated: boolean;
};

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family !== 6) return false;

  const mapped = address.toLowerCase().match(/^::ffff:(.+)$/)?.[1];
  if (mapped) {
    if (isIP(mapped) === 4) return isPublicIp(mapped);
    const words = mapped.split(":");
    if (words.length === 2 && words.every((word) => /^[0-9a-f]{1,4}$/.test(word))) {
      const high = Number.parseInt(words[0], 16);
      const low = Number.parseInt(words[1], 16);
      return isPublicIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return false;
  }
  return !blocked.check(address, "ipv6");
}

export function publicUrl(raw: string): URL {
  const value = raw.trim();
  if (!value) throw new Error("missing_url");
  if (value.length > 2048) throw new Error("url_too_long");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }
  if (url.username || url.password) throw new Error("url_auth_not_allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("host_not_allowed");
  }
  if (isIP(host) && !isPublicIp(host)) throw new Error("private_ip_not_allowed");
  return url;
}

function remaining(deadline: number): number {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new Error("upstream_timeout");
  return ms;
}

async function withinDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const ms = remaining(deadline);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("upstream_timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Resolve once and reject the hostname if any returned address is non-public. */
export async function resolvePublicAddress(
  hostname: string,
  deadline: number,
  lookup: LookupAll = dnsLookup,
): Promise<PublicAddress> {
  hostname = hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error("private_ip_not_allowed");
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let answers: { address: string; family: number }[];
  try {
    answers = await withinDeadline(lookup(hostname, { all: true, verbatim: true }), deadline);
  } catch (error) {
    if (String(error).includes("upstream_timeout")) throw error;
    throw new Error("dns_lookup_failed");
  }
  if (!Array.isArray(answers) || answers.length === 0) throw new Error("dns_no_records");
  if (answers.some((answer) => !isPublicIp(answer.address))) {
    throw new Error("resolves_to_private_ip");
  }
  const selected = answers[0];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

/** Make one non-redirecting request pinned to the validated DNS answer. */
export async function publicRequest(
  rawUrl: string,
  method: "GET" | "HEAD",
  maxBytes: number,
  deadline: number,
  extraHeaders: Record<string, string> = {},
  resolveAddress: typeof resolvePublicAddress = resolvePublicAddress,
): Promise<PublicResponse> {
  const url = publicUrl(rawUrl);
  const urlHostname = url.hostname.replace(/^\[|\]$/g, "");
  const target = await resolveAddress(urlHostname, deadline);
  const client = url.protocol === "https:" ? https : http;
  const defaultPort = url.protocol === "https:" ? 443 : 80;
  const port = url.port ? Number(url.port) : defaultPort;
  const hostHeader = url.host;

  return new Promise<PublicResponse>((resolve, reject) => {
    let settled = false;
    let absoluteTimer: NodeJS.Timeout | undefined;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (absoluteTimer) clearTimeout(absoluteTimer);
      reject(error);
    };
    const req = client.request(
      {
        hostname: target.address,
        family: target.family,
        port,
        path: `${url.pathname}${url.search}`,
        method,
        servername: url.protocol === "https:" && !isIP(urlHostname) ? urlHostname : undefined,
        rejectUnauthorized: true,
        headers: {
          Host: hostHeader,
          "User-Agent": "x402-vending-machine/0.2 (+public-probe)",
          ...extraHeaders,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        let kept = 0;
        let truncated = false;

        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (kept < maxBytes) {
            const slice = chunk.subarray(0, Math.max(0, maxBytes - kept));
            chunks.push(slice);
            kept += slice.length;
          }
          if (bytes > maxBytes) truncated = true;
          if (truncated) response.destroy();
        });
        const finish = () => {
          if (settled) return;
          settled = true;
          if (absoluteTimer) clearTimeout(absoluteTimer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
            else if (value !== undefined) headers.set(key, String(value));
          }
          resolve({
            status: response.statusCode ?? 0,
            headers,
            body: new Uint8Array(Buffer.concat(chunks)),
            bytes,
            truncated,
          });
        };
        response.on("end", finish);
        response.on("close", () => {
          if (truncated) finish();
        });
        response.on("error", (error) => {
          if (!truncated) fail(new Error(`upstream_read_failed: ${error.message}`));
        });
      },
    );

    req.on("error", (error) => fail(new Error(`upstream_request_failed: ${error.message}`)));
    absoluteTimer = setTimeout(() => {
      req.destroy();
      fail(new Error("upstream_timeout"));
    }, remaining(deadline));
    req.setTimeout(remaining(deadline), () => {
      req.destroy();
      fail(new Error("upstream_timeout"));
    });
    req.end();
  });
}
