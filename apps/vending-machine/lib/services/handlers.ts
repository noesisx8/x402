import type { VendingHandler } from "@/lib/services/types";
import {
  baseWalletSnapshot,
  fetchPageText,
  resolveDnsRecords,
  safeHttpGet,
} from "@/lib/services/agent-utils";
import {
  fxRates,
  hostFromBundleQuery,
  httpHead,
  redirectTrace,
  resolveDns,
  resolveMx,
  tlsCertPeek,
  whoisLite,
} from "@/lib/services/infra";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Expanded disposable / throwaway domains (heuristic list — not a paid blocklist). */
const DISPOSABLE_DOMAINS = new Set(
  [
    "mailinator.com",
    "tempmail.com",
    "guerrillamail.com",
    "guerrillamail.org",
    "10minutemail.com",
    "temp-mail.org",
    "yopmail.com",
    "trashmail.com",
    "discard.email",
    "sharklasers.com",
    "getnada.com",
    "maildrop.cc",
  ].map((d) => d.toLowerCase()),
);

/**
 * Email validation with real DoH MX lookup (no mock).
 * Format + disposable heuristic + live MX records.
 */
export const emailValidateHandler: VendingHandler = async (_req, query) => {
  const email = String(query.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("missing email");
  const valid_format = emailRegex.test(email);
  const domain = email.split("@")[1] ?? "";
  if (!valid_format || !domain) {
    return {
      email,
      valid_format: false,
      domain: domain || null,
      likely_disposable: false,
      has_mx: false,
      null_mx: false,
      mx: [] as { priority: number; host: string }[],
      mx_source: null as string | null,
      mx_ms: 0,
    };
  }

  const likely_disposable = DISPOSABLE_DOMAINS.has(domain);
  let mxResult: Awaited<ReturnType<typeof resolveMx>>;
  try {
    mxResult = await resolveMx(domain);
  } catch (e) {
    throw new Error(`mx_lookup_failed: ${String(e).slice(0, 120)}`);
  }

  return {
    email,
    valid_format: true,
    domain,
    likely_disposable,
    has_mx: mxResult.has_mx,
    null_mx: mxResult.null_mx,
    mx: mxResult.mx,
    mx_source: mxResult.source,
    mx_ms: mxResult.ms,
  };
};

export const ipLookupHandler: VendingHandler = async (_req, query) => {
  const ip = String(query.ip ?? "").trim();
  if (!ip) throw new Error("missing ip");
  // Basic shape check (v4 or v6-ish) — avoid arbitrary hostnames hitting geo API
  if (!/^[\d.:a-fA-F]+$/.test(ip) || ip.length > 45) throw new Error("invalid_ip");
  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "x402-vending-machine/0.1" },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.error) throw new Error(`geo_error: ${String(data.reason ?? data.error)}`);
  return {
    ip,
    country: data.country_name ?? null,
    country_code: data.country_code ?? null,
    city: data.city ?? null,
    org: data.org ?? null,
    asn: data.asn ?? null,
    source: "ipapi.co",
  };
};

export const weatherHandler: VendingHandler = async (_req, query) => {
  const city = String(query.city ?? "London").trim();
  if (!city) throw new Error("missing city");
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!geo.ok) throw new Error(`geocode upstream ${geo.status}`);
  const geoJson = (await geo.json()) as {
    results?: { latitude: number; longitude: number; name: string }[];
  };
  const hit = geoJson.results?.[0];
  if (!hit) throw new Error("city_not_found");
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,wind_speed_10m`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!wx.ok) throw new Error(`weather upstream ${wx.status}`);
  const wxJson = (await wx.json()) as { current?: Record<string, number> };
  if (!wxJson.current || typeof wxJson.current !== "object") {
    throw new Error("weather_empty");
  }
  return {
    city: hit.name,
    latitude: hit.latitude,
    longitude: hit.longitude,
    current: wxJson.current,
    source: "open-meteo.com",
  };
};

export const cryptoPricesHandler: VendingHandler = async (_req, query) => {
  const ids = String(query.ids ?? "bitcoin,ethereum").trim();
  if (!ids) throw new Error("missing ids");
  const idList = ids
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 25);
  if (idList.length === 0) throw new Error("missing ids");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idList.join(","))}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const prices = (await res.json()) as Record<string, unknown>;
  if (!prices || typeof prices !== "object" || Object.keys(prices).length === 0) {
    throw new Error("coingecko_empty");
  }
  return {
    ids: idList,
    prices,
    vs: "usd",
    include_24hr_change: true,
    source: "api.coingecko.com",
  };
};

/**
 * QR: returns a live third-party PNG URL (api.qrserver.com), not a fabricated image.
 * We HEAD-check the generator accepts the request shape; bytes are served by that CDN.
 */
export const qrGeneratorHandler: VendingHandler = async (_req, query) => {
  const data = String(query.data ?? "").trim();
  if (!data || data.length > 2048) throw new Error("invalid data");
  const size = Math.min(512, Math.max(128, Number(query.size ?? 256) || 256));
  const png_url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  // Prove upstream is reachable (real image), fail closed if generator is down
  let probe = await fetch(png_url, {
    method: "HEAD",
    signal: AbortSignal.timeout(8000),
  });
  if (!probe.ok || !(probe.headers.get("content-type") ?? "").includes("image")) {
    probe = await fetch(png_url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: { Range: "bytes=0-64" },
    });
  }
  if (!probe.ok) throw new Error(`qr_upstream_${probe.status}`);
  const ct = probe.headers.get("content-type") ?? "";
  if (!ct.includes("image")) throw new Error("qr_upstream_not_image");
  // Consume small body if GET was used
  if (probe.body) {
    try {
      await probe.arrayBuffer();
    } catch {
      /* ignore */
    }
  }

  return {
    data_preview: data.slice(0, 80),
    png_url,
    size,
    content_type: ct,
    source: "api.qrserver.com",
  };
};

/** Phase 2 — DNS A/AAAA via DoH (60s cache). */
export const dnsResolveHandler: VendingHandler = async (_req, query) => {
  const host = String(query.host ?? query.domain ?? "").trim();
  if (!host) throw new Error("missing host");
  const dns = await resolveDns(host);
  return { ...dns };
};

/** Phase 2 — HTTP HEAD (GET fallback) with SSRF guards. */
export const httpHeadHandler: VendingHandler = async (_req, query) => {
  const url = String(query.url ?? "").trim();
  if (!url) throw new Error("missing url");
  const head = await httpHead(url);
  return { ...head };
};

/**
 * Phase 2 — Agent bundle: DNS + HEAD + TLS cert in one 402.
 * Query: host=example.com  OR  url=https://example.com/path
 */
export const bundleInfraHandler: VendingHandler = async (_req, query) => {
  const { host, url } = hostFromBundleQuery(query);
  const started = Date.now();

  const [dnsSettled, headSettled, tlsSettled] = await Promise.allSettled([
    resolveDns(host),
    httpHead(url),
    tlsCertPeek(host),
  ]);

  const pick = <T,>(r: PromiseSettledResult<T>) =>
    r.status === "fulfilled"
      ? { ok: true as const, data: r.value }
      : { ok: false as const, error: String(r.reason).slice(0, 160) };

  const dns = pick(dnsSettled);
  const head = pick(headSettled);
  const tls = pick(tlsSettled);

  if (!dns.ok && !head.ok && !tls.ok) {
    throw new Error(
      `bundle_all_failed: dns=${dns.ok ? "ok" : dns.error}; head=${head.ok ? "ok" : head.error}; tls=${tls.ok ? "ok" : tls.error}`,
    );
  }

  return {
    host,
    url,
    ms_total: Date.now() - started,
    dns,
    http_head: head,
    tls,
  };
};

/** Phase 2 — standalone TLS certificate peek. */
export const tlsCertHandler: VendingHandler = async (_req, query) => {
  const host = String(query.host ?? query.domain ?? "").trim();
  if (!host) throw new Error("missing host");
  const port = query.port !== undefined ? String(query.port) : undefined;
  const tls = await tlsCertPeek(host, port);
  return { ...tls };
};

/** Phase 2 — RDAP domain intel (lite, no full WHOIS dump). */
export const whoisLiteHandler: VendingHandler = async (_req, query) => {
  const domain = String(query.domain ?? query.host ?? "").trim();
  if (!domain) throw new Error("missing domain");
  const whois = await whoisLite(domain);
  return { ...whois };
};

/** Fiat FX — live ECB/open.er-api rates (no mock). */
export const fxRateHandler: VendingHandler = async (_req, query) => {
  const base = String(query.base ?? query.from ?? "USD").trim();
  const symbols = String(query.symbols ?? query.to ?? "EUR,GBP,JPY").trim();
  const fx = await fxRates(base, symbols);
  return { ...fx };
};

/** Redirect chain trace — real hop statuses, SSRF-safe. */
export const redirectTraceHandler: VendingHandler = async (_req, query) => {
  const url = String(query.url ?? "").trim();
  if (!url) throw new Error("missing url");
  const max = Math.min(10, Math.max(1, Number(query.max_hops ?? 10) || 10));
  const trace = await redirectTrace(url, max);
  return { ...trace };
};

/** Multi-type DNS (A/AAAA/MX/TXT/NS/CNAME) one call — high agent demand. */
export const dnsRecordsHandler: VendingHandler = async (_req, query) => {
  const host = String(query.host ?? query.domain ?? "").trim();
  if (!host) throw new Error("missing host");
  const types = query.types !== undefined ? String(query.types) : undefined;
  const out = await resolveDnsRecords(host, types);
  return { ...out };
};

/** Limited public GET — JSON or text body for agents (SSRF-safe, size-capped). */
export const httpGetHandler: VendingHandler = async (_req, query) => {
  const url = String(query.url ?? "").trim();
  if (!url) throw new Error("missing url");
  const max = Math.min(48_000, Math.max(1024, Number(query.max_bytes ?? 48_000) || 48_000));
  const got = await safeHttpGet(url, max);
  return { ...got };
};

/** HTML → plain text extract for research / RAG agents. */
export const fetchTextHandler: VendingHandler = async (_req, query) => {
  const url = String(query.url ?? "").trim();
  if (!url) throw new Error("missing url");
  const maxChars = Math.min(20_000, Math.max(500, Number(query.max_chars ?? 12_000) || 12_000));
  const page = await fetchPageText(url, maxChars);
  return { ...page, source: "fetch+html-strip" };
};

/** Base mainnet ETH + USDC balances — agent wallets / treasury checks. */
export const baseBalanceHandler: VendingHandler = async (_req, query) => {
  const address = String(query.address ?? query.wallet ?? "").trim();
  if (!address) throw new Error("missing address");
  const snap = await baseWalletSnapshot(address);
  return { ...snap };
};

/**
 * Outbound / lead-gen pack — email MX + IP geo + HTTP HEAD in one 402.
 * Bundle price targets ≈ sum of atoms for sticky multi-signal agent jobs.
 */
export const bundleOutboundHandler: VendingHandler = async (req, query) => {
  const email = String(query.email ?? "").trim();
  const ip = String(query.ip ?? "").trim();
  const url = String(query.url ?? "").trim();
  if (!email) throw new Error("missing email");
  if (!ip) throw new Error("missing ip");
  if (!url) throw new Error("missing url");

  const started = Date.now();
  const [emailSettled, ipSettled, headSettled] = await Promise.allSettled([
    emailValidateHandler(req, { email }),
    ipLookupHandler(req, { ip }),
    httpHeadHandler(req, { url }),
  ]);

  const pick = <T,>(r: PromiseSettledResult<T>) =>
    r.status === "fulfilled"
      ? { ok: true as const, data: r.value }
      : { ok: false as const, error: String(r.reason).slice(0, 160) };

  const emailPart = pick(emailSettled);
  const ipPart = pick(ipSettled);
  const headPart = pick(headSettled);

  if (!emailPart.ok && !ipPart.ok && !headPart.ok) {
    throw new Error(
      `bundle_outbound_all_failed: email=${emailPart.ok ? "ok" : emailPart.error}; ip=${ipPart.ok ? "ok" : ipPart.error}; head=${headPart.ok ? "ok" : headPart.error}`,
    );
  }

  return {
    email: emailPart,
    ip: ipPart,
    http_head: headPart,
    ms_total: Date.now() - started,
  };
};

/**
 * Kronos candle forecast — proxies Railway (or portalv2) inference API.
 * Fail-closed: backend errors throw → 400 → no settle.
 */
export const kronosForecastHandler: VendingHandler = async (_req, query) => {
  const { callKronosForecast } = await import("@/lib/services/kronos-client");
  const symbol = String(query.symbol ?? "BTCUSDT").trim().toUpperCase();
  const interval = String(query.interval ?? "1h").trim();
  const lookback = Number(query.lookback ?? 128) || 128;
  const pred_len = Number(query.pred_len ?? 12) || 12;
  const model = String(query.model ?? "mini").trim().toLowerCase();
  return callKronosForecast({ symbol, interval, lookback, pred_len, model });
};

/**
 * Domain intel pack — DNS + TLS + WHOIS + HEAD in one payment.
 * Differentiator for security / brand agents.
 */
export const domainIntelHandler: VendingHandler = async (_req, query) => {
  const hostOrUrl = String(query.host ?? query.domain ?? query.url ?? "").trim();
  if (!hostOrUrl) throw new Error("missing host or url");
  const { host, url } = hostFromBundleQuery(
    hostOrUrl.includes("://")
      ? { url: hostOrUrl }
      : { host: hostOrUrl },
  );
  const started = Date.now();
  const [dns, tls, whois, head] = await Promise.allSettled([
    resolveDns(host),
    tlsCertPeek(host),
    whoisLite(host),
    httpHead(url),
  ]);
  const pick = <T,>(r: PromiseSettledResult<T>) =>
    r.status === "fulfilled"
      ? { ok: true as const, data: r.value }
      : { ok: false as const, error: String(r.reason).slice(0, 160) };

  const parts = {
    dns: pick(dns),
    tls: pick(tls),
    whois: pick(whois),
    http_head: pick(head),
  };
  if (!parts.dns.ok && !parts.tls.ok && !parts.whois.ok && !parts.http_head.ok) {
    throw new Error("domain_intel_all_failed");
  }
  return {
    host,
    url,
    ms_total: Date.now() - started,
    ...parts,
  };
};
