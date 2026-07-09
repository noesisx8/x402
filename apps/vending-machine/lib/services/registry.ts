/**
 * VENDING MACHINE REGISTRY
 * Add a service: append one object below — path, price, handler.
 * Paid route auto-exposed at GET /api/v/{slug}
 *
 * Prices are validated against GLOBAL_MAX_PRICE_USD at wrap time (Phase 0.5).
 * All handlers must return live upstream data — no mock/fake payloads.
 */
import {
  bundleInfraHandler,
  cryptoPricesHandler,
  dnsResolveHandler,
  emailValidateHandler,
  fxRateHandler,
  httpHeadHandler,
  ipLookupHandler,
  qrGeneratorHandler,
  redirectTraceHandler,
  tlsCertHandler,
  weatherHandler,
  whoisLiteHandler,
} from "@/lib/services/handlers";
import type { VendingService } from "@/lib/services/types";
import { assertPriceWithinCap } from "@/lib/pricing";

export const VENDING_SERVICES: VendingService[] = [
  {
    slug: "email-validate",
    name: "Email validation",
    description: "Format + disposable heuristic + live DoH MX records",
    price: "$0.004",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "email", required: true }],
    handler: emailValidateHandler,
  },
  {
    slug: "ip-lookup",
    name: "IP geolocation",
    description: "Country, city, ASN via ipapi.co (live)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "ip", required: true }],
    handler: ipLookupHandler,
  },
  {
    slug: "weather",
    name: "Weather snapshot",
    description: "Current temperature and wind (Open-Meteo, live)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "city", required: false, description: "Default London" }],
    handler: weatherHandler,
  },
  {
    slug: "crypto-prices",
    name: "Crypto spot prices",
    description: "USD spot prices from CoinGecko simple API (live)",
    price: "$0.005",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "ids", required: false, description: "Comma-separated CoinGecko ids" }],
    handler: cryptoPricesHandler,
  },
  {
    slug: "qr-code",
    name: "QR code",
    description: "PNG QR URL via api.qrserver.com (upstream probed live)",
    price: "$0.002",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "data", required: true },
      { name: "size", required: false },
    ],
    handler: qrGeneratorHandler,
  },
  {
    slug: "dns-resolve",
    name: "DNS resolve",
    description: "A/AAAA lookup via DNS-over-HTTPS (60s cache)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "host", required: true, description: "Hostname e.g. example.com" },
    ],
    handler: dnsResolveHandler,
  },
  {
    slug: "http-head",
    name: "HTTP HEAD probe",
    description: "Status, latency, and header subset for a public URL",
    price: "$0.002",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "url", required: true, description: "https://… public URL" },
    ],
    handler: httpHeadHandler,
  },
  {
    slug: "bundle-infra",
    name: "Infra bundle (DNS + HEAD + TLS)",
    description: "One payment: DNS A/AAAA, HTTP HEAD, and TLS certificate peek",
    price: "$0.01",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "host", required: false, description: "Hostname (or use url)" },
      { name: "url", required: false, description: "Full URL (or use host)" },
    ],
    handler: bundleInfraHandler,
  },
  {
    slug: "tls-cert",
    name: "TLS certificate peek",
    description: "Peer cert subject, issuer, expiry, and authorization status",
    price: "$0.004",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "host", required: true, description: "Hostname e.g. example.com" },
      { name: "port", required: false, description: "443 (default) or 8443" },
    ],
    handler: tlsCertHandler,
  },
  {
    slug: "whois-lite",
    name: "WHOIS / RDAP lite",
    description: "Domain status, registrar, dates, nameservers via RDAP",
    price: "$0.008",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "domain", required: true, description: "example.com (host= also accepted)" },
    ],
    handler: whoisLiteHandler,
  },
  {
    slug: "fx-rate",
    name: "FX rates",
    description: "Live fiat exchange rates (Frankfurter/ECB, open.er-api fallback)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "base", required: false, description: "ISO 4217 base, default USD" },
      { name: "symbols", required: false, description: "Comma list e.g. EUR,GBP,JPY" },
    ],
    handler: fxRateHandler,
  },
  {
    slug: "redirect-trace",
    name: "Redirect trace",
    description: "Follow public redirect chain; per-hop status (SSRF-safe)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "url", required: true, description: "Starting https:// URL" },
      { name: "max_hops", required: false, description: "1–10, default 10" },
    ],
    handler: redirectTraceHandler,
  },
];

for (const s of VENDING_SERVICES) {
  assertPriceWithinCap(s.price);
}

export const SERVICES_BY_SLUG = Object.fromEntries(
  VENDING_SERVICES.filter((s) => s.enabled).map((s) => [s.slug, s]),
) as Record<string, VendingService>;
