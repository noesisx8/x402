/**
 * Outbound HTTP for customer-supplied URLs.
 * Resolve once, reject non-public answers, connect only to a pinned address,
 * and re-check every redirect hop. Resolver errors fail closed.
 */

import * as http from "node:http";
import * as https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assertPublicHostname, isPublicIp } from "./ip.js";

export const DEFAULT_ALLOWED_PORTS = [80, 443, 8443] as const;

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type AddressLookup = (hostname: string) => Promise<{ address: string; family: number }[]>;

export type ProbeTarget = {
  address: string;
  family: 4 | 6;
  port: number;
  method: "GET" | "HEAD";
  path: string;
  protocol: "http:" | "https:";
  servername?: string;
  hostHeader: string;
  headers: Record<string, string>;
};

export type ProbeExchange = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body?: Uint8Array;
  truncated?: boolean;
};

export type ProbeDispatch = (target: ProbeTarget, timeoutMs: number, maxBytes: number) => Promise<ProbeExchange>;

export type PublicHttpHop = {
  url: string;
  status: number;
  location: string | null;
  ms: number;
};

export type PublicHttpResult = {
  url: string;
  finalUrl: string;
  status: number;
  headers: Headers;
  body: Uint8Array;
  truncated: boolean;
  hops: PublicHttpHop[];
  ms: number;
};

export type PublicHttpOptions = {
  lookup?: AddressLookup;
  dispatch?: ProbeDispatch;
  timeoutMs?: number;
  maxHops?: number;
  maxBytes?: number;
  allowedPorts?: readonly number[];
  headers?: Record<string, string>;
  /** When HEAD is rejected by the origin, try one GET against the same pinned address. */
  fallbackGet?: boolean;
};

export function assertPublicUrl(raw: string, allowedPorts: readonly number[] = DEFAULT_ALLOWED_PORTS): URL {
  const value = raw.trim();
  if (!value) throw new Error("missing_url");
  if (value.length > 2048) throw new Error("url_too_long");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_protocol");
  if (url.username || url.password) throw new Error("url_auth_not_allowed");
  assertPublicHostname(url.hostname);
  const port = portOf(url);
  if (!allowedPorts.includes(port)) throw new Error("port_not_allowed");
  return url;
}

export function portOf(url: URL): number {
  if (!url.port) return url.protocol === "https:" ? 443 : 80;
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port_not_allowed");
  return port;
}

export async function systemLookup(hostname: string): Promise<{ address: string; family: number }[]> {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family }));
}

/** Resolve once. Any non-public answer, empty answer, or resolver error rejects the name. */
export async function resolvePublicAddress(
  hostname: string,
  lookup: AddressLookup = systemLookup,
): Promise<ResolvedAddress> {
  const host = assertPublicHostname(hostname);
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new Error("private_ip_not_allowed");
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  let answers: { address: string; family: number }[];
  try {
    answers = await lookup(host);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "host_not_allowed" || message === "private_ip_not_allowed" || message === "invalid_host") {
      throw error;
    }
    throw new Error("dns_lookup_failed");
  }
  if (!Array.isArray(answers) || answers.length === 0) throw new Error("dns_no_records");
  for (const answer of answers) {
    if (!answer || typeof answer.address !== "string" || !isPublicIp(answer.address)) {
      throw new Error("resolves_to_private_ip");
    }
  }
  const selected = answers[0];
  return { address: selected.address, family: selected.family === 6 ? 6 : 4 };
}

function headerValue(headers: ProbeExchange["headers"], name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target || value === undefined) continue;
    return Array.isArray(value) ? (value[0] ?? null) : String(value);
  }
  return null;
}

function toHeaders(headers: ProbeExchange["headers"]): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) out.append(key, entry);
    } else {
      out.set(key, String(value));
    }
  }
  return out;
}

export function nodeDispatch(target: ProbeTarget, timeoutMs: number, maxBytes: number): Promise<ProbeExchange> {
  const client = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error("upstream_failed"));
    };
    const req = client.request(
      {
        host: target.address,
        family: target.family,
        port: target.port,
        method: target.method,
        path: target.path,
        servername: target.servername,
        rejectUnauthorized: true,
        headers: {
          "User-Agent": "x402-probe/1",
          ...target.headers,
          Host: target.hostHeader,
          Connection: "close",
        },
        lookup: ((
          _hostname: string,
          options: unknown,
          callback?: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
        ) => {
          const done =
            typeof options === "function"
              ? (options as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)
              : callback;
          done?.(null, target.address, target.family);
        }) as never,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: new Uint8Array(Buffer.concat(chunks)),
            truncated,
          });
        };
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            response.destroy();
            return;
          }
          if (chunk.length > 0) chunks.push(chunk);
        });
        response.on("end", finish);
        response.on("close", () => {
          if (truncated) finish();
        });
        response.on("error", () => {
          if (!truncated) fail();
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      fail();
    });
    req.on("error", () => fail());
    req.end();
  });
}

/**
 * Fetch a customer URL. Never uses redirect:"follow".
 * Each hop is resolved and pinned again before connect.
 */
export async function publicHttp(
  rawUrl: string,
  method: "GET" | "HEAD",
  options: PublicHttpOptions = {},
): Promise<PublicHttpResult> {
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  const lookup = options.lookup ?? systemLookup;
  const dispatch = options.dispatch ?? nodeDispatch;
  const timeoutMs = options.timeoutMs ?? 7_000;
  const maxBytes = options.maxBytes ?? 48_000;
  const maxHops = Math.min(10, Math.max(1, options.maxHops ?? 8));
  const extraHeaders = options.headers ?? {};
  const started = Date.now();

  let current = assertPublicUrl(rawUrl, allowedPorts);
  const startUrl = current.toString();
  const hops: PublicHttpHop[] = [];

  for (let hop = 0; hop < maxHops; hop++) {
    const hopUrl = assertPublicUrl(current.toString(), allowedPorts);
    const host = assertPublicHostname(hopUrl.hostname);
    const pinned = await resolvePublicAddress(host, lookup);
    if (!isPublicIp(pinned.address)) throw new Error("resolves_to_private_ip");

    const targetBase: Omit<ProbeTarget, "method"> = {
      address: pinned.address,
      family: pinned.family,
      port: portOf(hopUrl),
      path: `${hopUrl.pathname}${hopUrl.search}`,
      protocol: hopUrl.protocol as "http:" | "https:",
      servername: hopUrl.protocol === "https:" && !isIP(host) ? host : undefined,
      hostHeader: hopUrl.host,
      headers: {
        "User-Agent": extraHeaders["User-Agent"] ?? "x402-probe/1",
        ...extraHeaders,
      },
    };

    const hopStarted = Date.now();
    let exchange: ProbeExchange | undefined;
    try {
      exchange = await dispatch({ ...targetBase, method }, timeoutMs, method === "HEAD" ? 0 : maxBytes);
      if (
        method === "HEAD" &&
        options.fallbackGet &&
        (exchange.status === 405 || exchange.status === 501)
      ) {
        exchange = await dispatch({ ...targetBase, method: "GET" }, timeoutMs, maxBytes);
      }
    } catch (error) {
      if (method === "HEAD" && options.fallbackGet) {
        try {
          exchange = await dispatch({ ...targetBase, method: "GET" }, timeoutMs, maxBytes);
        } catch {
          throw new Error("upstream_failed");
        }
      } else if (error instanceof Error && /^(host_not_allowed|private_ip_not_allowed|resolves_to_private_ip|port_not_allowed|dns_lookup_failed|dns_no_records|invalid_host)$/.test(error.message)) {
        throw error;
      } else {
        throw new Error("upstream_failed");
      }
    }

    if (!exchange) throw new Error("upstream_failed");
    const location = headerValue(exchange.headers, "location");
    const redirecting = exchange.status >= 300 && exchange.status < 400 && Boolean(location);
    hops.push({
      url: hopUrl.toString(),
      status: exchange.status,
      location: null,
      ms: Date.now() - hopStarted,
    });

    if (!redirecting || !location) {
      return {
        url: startUrl,
        finalUrl: hopUrl.toString(),
        status: exchange.status,
        headers: toHeaders(exchange.headers),
        body: exchange.body ?? new Uint8Array(),
        truncated: Boolean(exchange.truncated),
        hops,
        ms: Date.now() - started,
      };
    }

    let next: URL;
    try {
      next = assertPublicUrl(new URL(location, hopUrl).toString(), allowedPorts);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("host_not_allowed");
    }
    hops[hops.length - 1].location = next.toString();
    if (hop === maxHops - 1) throw new Error("too_many_redirects");
    current = next;
  }

  throw new Error("too_many_redirects");
}
