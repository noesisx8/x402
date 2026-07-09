import type { VendingHandler } from "@/lib/services/types";
import {
  hostFromBundleQuery,
  httpHead,
  resolveDns,
  tlsCertPeek,
} from "@/lib/services/infra";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailValidateHandler: VendingHandler = async (_req, query) => {
  const email = String(query.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("missing email");
  const valid = emailRegex.test(email);
  const disposableDomains = ["mailinator.com", "tempmail.com", "guerrillamail.com"];
  const domain = email.split("@")[1] ?? "";
  return {
    email,
    valid_format: valid,
    domain,
    likely_disposable: disposableDomains.includes(domain),
    mx_check: "mock_ok",
  };
};

export const ipLookupHandler: VendingHandler = async (_req, query) => {
  const ip = String(query.ip ?? "").trim();
  if (!ip) throw new Error("missing ip");
  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return {
    ip,
    country: data.country_name,
    country_code: data.country_code,
    city: data.city,
    org: data.org,
    asn: data.asn,
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
  // Throw so withX402 does NOT settle (status 400 path)
  if (!hit) throw new Error("city_not_found");
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,wind_speed_10m`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!wx.ok) throw new Error(`weather upstream ${wx.status}`);
  const wxJson = (await wx.json()) as { current?: Record<string, number> };
  return {
    city: hit.name,
    latitude: hit.latitude,
    longitude: hit.longitude,
    current: wxJson.current ?? {},
  };
};

export const cryptoPricesHandler: VendingHandler = async (_req, query) => {
  const ids = String(query.ids ?? "bitcoin,ethereum").trim();
  if (!ids) throw new Error("missing ids");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  return { ids: ids.split(",").map((s) => s.trim()).filter(Boolean), prices: await res.json() };
};

export const qrGeneratorHandler: VendingHandler = async (_req, query) => {
  const data = String(query.data ?? "").trim();
  if (!data || data.length > 2048) throw new Error("invalid data");
  const size = Math.min(512, Math.max(128, Number(query.size ?? 256) || 256));
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  return {
    data_preview: data.slice(0, 80),
    png_url: url,
    size,
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

  // Parallel DNS + TLS; HEAD after we have a URL (can run parallel too)
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

  // At least one probe must succeed or we refuse to settle (400)
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
