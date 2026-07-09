/**
 * Shared infra probes for Phase 2: DNS, HTTP HEAD, TLS cert peek.
 * Fail closed (throw) so withX402 never settles on bad input / probe failure.
 */

import * as tls from "node:tls";
import { lookup as dnsLookup } from "node:dns/promises";

const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/i;

export type DnsResult = {
  host: string;
  a: string[];
  aaaa: string[];
  source: "doh" | "system";
  ms: number;
};

export type HeadResult = {
  url: string;
  final_url: string;
  status: number;
  ok: boolean;
  ms: number;
  headers: {
    "content-type": string | null;
    server: string | null;
    "content-length": string | null;
    location: string | null;
  };
};

export type TlsResult = {
  host: string;
  port: number;
  valid: boolean;
  protocol: string | null;
  authorized: boolean;
  authorization_error: string | null;
  subject: Record<string, string> | null;
  issuer: Record<string, string> | null;
  valid_from: string | null;
  valid_to: string | null;
  days_until_expiry: number | null;
  fingerprint256: string | null;
  ms: number;
};

// --- DNS cache (60s TTL, per isolate) ---
type CacheEntry<T> = { at: number; value: T };
const dnsCache = new Map<string, CacheEntry<DnsResult>>();
const DNS_TTL_MS = 60_000;

export function normalizeHost(raw: string): string {
  let h = raw.trim().toLowerCase();
  if (!h) throw new Error("missing host");
  // strip scheme / path if user pasted a URL
  if (h.includes("://")) {
    try {
      h = new URL(h).hostname;
    } catch {
      throw new Error("invalid_host");
    }
  }
  h = h.replace(/\.$/, "");
  if (h.length > 253 || !HOST_RE.test(h)) throw new Error("invalid_host");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    throw new Error("host_not_allowed");
  }
  return h;
}

function isPrivateIp(ip: string): boolean {
  // IPv4
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  // IPv6 simplified
  const v6 = ip.toLowerCase();
  if (v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA
  if (v6.startsWith("fe80")) return true; // link-local
  if (v6.startsWith("::ffff:")) {
    return isPrivateIp(v6.slice(7));
  }
  return false;
}

/** Cloudflare DNS-over-HTTPS (JSON). */
export async function resolveDns(host: string): Promise<DnsResult> {
  const h = normalizeHost(host);
  const cached = dnsCache.get(h);
  if (cached && Date.now() - cached.at < DNS_TTL_MS) {
    return { ...cached.value, source: cached.value.source };
  }

  const started = Date.now();
  const doh = async (type: "A" | "AAAA"): Promise<string[]> => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${type}`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`doh_${type}_${res.status}`);
    const j = (await res.json()) as {
      Answer?: { type: number; data: string }[];
    };
    const want = type === "A" ? 1 : 28;
    return (j.Answer ?? [])
      .filter((a) => a.type === want)
      .map((a) => a.data.replace(/\.$/, ""));
  };

  let a: string[] = [];
  let aaaa: string[] = [];
  let source: DnsResult["source"] = "doh";
  try {
    [a, aaaa] = await Promise.all([doh("A"), doh("AAAA")]);
  } catch {
    // Fallback: system resolver (Node)
    source = "system";
    const [v4, v6] = await Promise.all([
      dnsLookup(h, { all: true, family: 4 }).catch(() => [] as { address: string }[]),
      dnsLookup(h, { all: true, family: 6 }).catch(() => [] as { address: string }[]),
    ]);
    a = (Array.isArray(v4) ? v4 : []).map((x) => x.address);
    aaaa = (Array.isArray(v6) ? v6 : []).map((x) => x.address);
  }

  if (a.length === 0 && aaaa.length === 0) {
    throw new Error("dns_no_records");
  }

  const result: DnsResult = {
    host: h,
    a,
    aaaa,
    source,
    ms: Date.now() - started,
  };
  dnsCache.set(h, { at: Date.now(), value: result });
  return result;
}

function assertPublicUrl(raw: string): URL {
  const s = raw.trim();
  if (!s) throw new Error("missing url");
  if (s.length > 2048) throw new Error("url_too_long");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }
  if (u.username || u.password) throw new Error("url_auth_not_allowed");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("host_not_allowed");
  }
  if (isPrivateIp(host)) throw new Error("private_ip_not_allowed");
  return u;
}

/** Resolve hostname and reject private A/AAAA (SSRF guard). */
export async function assertPublicHostResolves(host: string): Promise<void> {
  const h = normalizeHost(host);
  if (isPrivateIp(h)) throw new Error("private_ip_not_allowed");
  try {
    const addrs = await dnsLookup(h, { all: true });
    const list = Array.isArray(addrs) ? addrs : [addrs];
    for (const a of list) {
      if (isPrivateIp(a.address)) throw new Error("resolves_to_private_ip");
    }
  } catch (e) {
    if (String(e).includes("private") || String(e).includes("not_allowed")) throw e;
    // NXDOMAIN etc. — let HEAD/TLS fail with their own errors
  }
}

export async function httpHead(urlRaw: string): Promise<HeadResult> {
  const u = assertPublicUrl(urlRaw);
  await assertPublicHostResolves(u.hostname);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "x402-vending-machine/0.1 (+infra-probe)" },
    });
  } catch (e) {
    // Some origins reject HEAD — fall back to GET with no body read
    try {
      res = await fetch(u.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(7000),
        headers: {
          "User-Agent": "x402-vending-machine/0.1 (+infra-probe)",
          Range: "bytes=0-0",
        },
      });
    } catch (e2) {
      throw new Error(`head_failed: ${String(e2).slice(0, 120)}`);
    }
  }

  // Block redirect into private hosts
  try {
    const final = new URL(res.url);
    if (isPrivateIp(final.hostname)) throw new Error("redirect_private_ip");
  } catch (e) {
    if (String(e).includes("private")) throw e;
  }

  return {
    url: u.toString(),
    final_url: res.url,
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    headers: {
      "content-type": res.headers.get("content-type"),
      server: res.headers.get("server"),
      "content-length": res.headers.get("content-length"),
      location: res.headers.get("location"),
    },
  };
}

function dnToObject(dn: string | undefined | null): Record<string, string> | null {
  if (!dn) return null;
  const out: Record<string, string> = {};
  for (const part of dn.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const [k, ...rest] = part.trim().split("=");
    if (k && rest.length) out[k.trim()] = rest.join("=").trim();
  }
  return Object.keys(out).length ? out : { cn: dn };
}

export async function tlsCertPeek(hostRaw: string, portRaw?: string | number): Promise<TlsResult> {
  const host = normalizeHost(hostRaw);
  await assertPublicHostResolves(host);
  const port = Number(portRaw ?? 443) || 443;
  if (!Number.isInteger(port) || (port !== 443 && port !== 8443)) {
    throw new Error("port_not_allowed");
  }

  const started = Date.now();
  return new Promise<TlsResult>((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false, // we report auth status ourselves
        timeout: 7000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          const proto = socket.getProtocol();
          const authorized = socket.authorized;
          const authErr = socket.authorizationError
            ? String(socket.authorizationError)
            : null;

          let validFrom: string | null = null;
          let validTo: string | null = null;
          let days: number | null = null;
          if (cert && cert.valid_from && cert.valid_to) {
            validFrom = new Date(cert.valid_from).toISOString();
            validTo = new Date(cert.valid_to).toISOString();
            days = Math.floor(
              (new Date(cert.valid_to).getTime() - Date.now()) / (24 * 3600 * 1000),
            );
          }

          const result: TlsResult = {
            host,
            port,
            valid: Boolean(cert && cert.valid_to && days !== null && days >= 0 && authorized),
            protocol: proto,
            authorized,
            authorization_error: authErr,
            subject: cert?.subject
              ? Object.fromEntries(
                  Object.entries(cert.subject as Record<string, string>).map(([k, v]) => [
                    k,
                    String(v),
                  ]),
                )
              : dnToObject(cert?.subjectaltname),
            issuer: cert?.issuer
              ? Object.fromEntries(
                  Object.entries(cert.issuer as Record<string, string>).map(([k, v]) => [
                    k,
                    String(v),
                  ]),
                )
              : null,
            valid_from: validFrom,
            valid_to: validTo,
            days_until_expiry: days,
            fingerprint256: cert?.fingerprint256 ?? null,
            ms: Date.now() - started,
          };
          socket.end();
          resolve(result);
        } catch (e) {
          socket.destroy();
          reject(new Error(`tls_parse_failed: ${String(e).slice(0, 100)}`));
        }
      },
    );

    socket.on("error", (err) => {
      socket.destroy();
      reject(new Error(`tls_failed: ${String(err.message).slice(0, 140)}`));
    });
    socket.setTimeout(7000, () => {
      socket.destroy();
      reject(new Error("tls_timeout"));
    });
  });
}

/** Target host for bundle: from host= or url= */
export function hostFromBundleQuery(query: Record<string, string | string[] | undefined>): {
  host: string;
  url: string;
} {
  const hostQ = query.host !== undefined ? String(query.host) : "";
  const urlQ = query.url !== undefined ? String(query.url) : "";
  if (urlQ.trim()) {
    const u = assertPublicUrl(urlQ);
    return { host: normalizeHost(u.hostname), url: u.toString() };
  }
  if (hostQ.trim()) {
    const host = normalizeHost(hostQ);
    return { host, url: `https://${host}/` };
  }
  throw new Error("missing host or url");
}

// --- WHOIS / RDAP (lite) ---

export type WhoisLiteResult = {
  domain: string;
  ldh_name: string | null;
  handle: string | null;
  status: string[];
  registered: string | null;
  expires: string | null;
  updated: string | null;
  registrar: string | null;
  nameservers: string[];
  rdap_conformance: string[] | null;
  source: "rdap";
  rdap_url: string;
  ms: number;
};

type RdapEntity = {
  roles?: string[];
  vcardArray?: unknown[];
  publicIds?: { type?: string; identifier?: string }[];
  entities?: RdapEntity[];
};

function vcardFn(entity: RdapEntity | undefined): string | null {
  if (!entity?.vcardArray || !Array.isArray(entity.vcardArray)) return null;
  const cards = entity.vcardArray[1];
  if (!Array.isArray(cards)) return null;
  for (const row of cards) {
    if (Array.isArray(row) && row[0] === "fn" && row[3]) return String(row[3]);
  }
  return null;
}

function findEntityByRole(entities: RdapEntity[] | undefined, role: string): RdapEntity | undefined {
  if (!entities) return undefined;
  for (const e of entities) {
    if (e.roles?.includes(role)) return e;
    const nested = findEntityByRole(e.entities, role);
    if (nested) return nested;
  }
  return undefined;
}

function eventDate(
  events: { eventAction?: string; eventDate?: string }[] | undefined,
  action: string,
): string | null {
  const hit = events?.find((e) => e.eventAction === action);
  if (!hit?.eventDate) return null;
  try {
    return new Date(hit.eventDate).toISOString();
  } catch {
    return hit.eventDate;
  }
}

/**
 * RDAP domain lookup (lite fields only — no full vCard dump / PII fishing).
 * Uses rdap.org bootstrap redirect.
 */
export async function whoisLite(domainRaw: string): Promise<WhoisLiteResult> {
  // Accept hostnames; strip www. for registry object
  let domain = normalizeHost(domainRaw);
  if (domain.startsWith("www.")) domain = domain.slice(4);

  // Basic TLD requirement (at least one dot)
  if (!domain.includes(".")) throw new Error("invalid_domain");

  const started = Date.now();
  const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  let res: Response;
  try {
    res = await fetch(rdapUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/rdap+json, application/json",
        "User-Agent": "x402-vending-machine/0.1 (+whois-lite)",
      },
    });
  } catch (e) {
    throw new Error(`rdap_failed: ${String(e).slice(0, 120)}`);
  }

  if (res.status === 404) throw new Error("domain_not_found");
  if (res.status === 429) throw new Error("rdap_rate_limited");
  if (!res.ok) throw new Error(`rdap_upstream_${res.status}`);

  const j = (await res.json()) as {
    ldhName?: string;
    handle?: string;
    status?: string[];
    events?: { eventAction?: string; eventDate?: string }[];
    entities?: RdapEntity[];
    nameservers?: { ldhName?: string }[];
    rdapConformance?: string[];
  };

  const registrarEnt = findEntityByRole(j.entities, "registrar");
  const registrar =
    vcardFn(registrarEnt) ??
    registrarEnt?.publicIds?.find((p) => p.type === "IANA Registrar ID")?.identifier ??
    null;

  const nameservers = (j.nameservers ?? [])
    .map((n) => n.ldhName)
    .filter((n): n is string => Boolean(n))
    .map((n) => n.toLowerCase().replace(/\.$/, ""));

  return {
    domain,
    ldh_name: j.ldhName ?? domain,
    handle: j.handle ?? null,
    status: Array.isArray(j.status) ? j.status.map(String) : [],
    registered: eventDate(j.events, "registration"),
    expires: eventDate(j.events, "expiration"),
    updated: eventDate(j.events, "last changed") ?? eventDate(j.events, "last update of RDAP database"),
    registrar,
    nameservers,
    rdap_conformance: j.rdapConformance ?? null,
    source: "rdap",
    rdap_url: res.url || rdapUrl,
    ms: Date.now() - started,
  };
}
