/**
 * VENDING MACHINE REGISTRY
 * Add a service: append one object below — path, price, handler, discovery.
 * Paid route auto-exposed at GET /api/v/{slug}
 * CDP Bazaar indexes routes after first successful settle with bazaar extensions.
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
    description:
      "Validate email format, disposable-domain heuristics, and live DNS MX records via DoH for outreach and lead-gen agents",
    price: "$0.004",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "email", required: true, description: "Email address to validate" }],
    handler: emailValidateHandler,
    discovery: {
      exampleQuery: { email: "test@gmail.com" },
      exampleOutput: {
        service: "email-validate",
        ok: true,
        email: "test@gmail.com",
        valid_format: true,
        has_mx: true,
        mx: [{ priority: 5, host: "gmail-smtp-in.l.google.com" }],
      },
    },
  },
  {
    slug: "ip-lookup",
    name: "IP geolocation",
    description: "Live IP geolocation: country, city, org, and ASN for fraud and routing agents",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "ip", required: true, description: "IPv4 or IPv6 address" }],
    handler: ipLookupHandler,
    discovery: {
      exampleQuery: { ip: "8.8.8.8" },
      exampleOutput: {
        service: "ip-lookup",
        ok: true,
        ip: "8.8.8.8",
        country_code: "US",
        org: "Google LLC",
      },
    },
  },
  {
    slug: "weather",
    name: "Weather snapshot",
    description: "Current temperature and wind for a city from Open-Meteo (live forecast data)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "city", required: false, description: "City name, default London" }],
    handler: weatherHandler,
    discovery: {
      exampleQuery: { city: "Berlin" },
      exampleOutput: {
        service: "weather",
        ok: true,
        city: "Berlin",
        current: { temperature_2m: 18.2, wind_speed_10m: 3.1 },
      },
    },
  },
  {
    slug: "crypto-prices",
    name: "Crypto spot prices",
    description: "Live USD spot prices for crypto assets via CoinGecko simple price API",
    price: "$0.005",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "ids", required: false, description: "Comma-separated CoinGecko ids e.g. bitcoin,ethereum" },
    ],
    handler: cryptoPricesHandler,
    discovery: {
      exampleQuery: { ids: "bitcoin,ethereum" },
      exampleOutput: {
        service: "crypto-prices",
        ok: true,
        prices: { bitcoin: { usd: 60000 }, ethereum: { usd: 3000 } },
      },
    },
  },
  {
    slug: "qr-code",
    name: "QR code",
    description: "Generate a PNG QR code URL for payment and onboarding payloads (upstream probed live)",
    price: "$0.002",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "data", required: true, description: "Payload to encode" },
      { name: "size", required: false, description: "Pixel size 128-512" },
    ],
    handler: qrGeneratorHandler,
    discovery: {
      exampleQuery: { data: "https://x402.org", size: "256" },
      exampleOutput: {
        service: "qr-code",
        ok: true,
        png_url: "https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=https%3A%2F%2Fx402.org",
      },
    },
  },
  {
    slug: "dns-resolve",
    name: "DNS resolve",
    description: "Resolve A and AAAA records for a public hostname via DNS-over-HTTPS (60s cache)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "host", required: true, description: "Hostname e.g. example.com" }],
    handler: dnsResolveHandler,
    discovery: {
      exampleQuery: { host: "example.com" },
      exampleOutput: {
        service: "dns-resolve",
        ok: true,
        host: "example.com",
        a: ["93.184.216.34"],
        aaaa: [],
        source: "doh",
      },
    },
  },
  {
    slug: "http-head",
    name: "HTTP HEAD probe",
    description: "Public URL status, latency, and response header subset for uptime and health agents",
    price: "$0.002",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "url", required: true, description: "Public https:// URL" }],
    handler: httpHeadHandler,
    discovery: {
      exampleQuery: { url: "https://example.com" },
      exampleOutput: {
        service: "http-head",
        ok: true,
        status: 200,
        ms: 40,
        headers: { "content-type": "text/html" },
      },
    },
  },
  {
    slug: "bundle-infra",
    name: "Infra bundle (DNS + HEAD + TLS)",
    description:
      "Single payment bundle: DNS A/AAAA, HTTP HEAD probe, and TLS certificate peek for agent infra workflows",
    price: "$0.01",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "host", required: false, description: "Hostname (or use url)" },
      { name: "url", required: false, description: "Full URL (or use host)" },
    ],
    handler: bundleInfraHandler,
    discovery: {
      exampleQuery: { host: "example.com" },
      exampleOutput: {
        service: "bundle-infra",
        ok: true,
        host: "example.com",
        dns: { ok: true },
        http_head: { ok: true },
        tls: { ok: true },
      },
    },
  },
  {
    slug: "tls-cert",
    name: "TLS certificate peek",
    description: "TLS peer certificate subject, issuer, expiry, and authorization status for a public host",
    price: "$0.004",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "host", required: true, description: "Hostname e.g. example.com" },
      { name: "port", required: false, description: "443 (default) or 8443" },
    ],
    handler: tlsCertHandler,
    discovery: {
      exampleQuery: { host: "example.com" },
      exampleOutput: {
        service: "tls-cert",
        ok: true,
        host: "example.com",
        authorized: true,
        days_until_expiry: 90,
      },
    },
  },
  {
    slug: "whois-lite",
    name: "WHOIS / RDAP lite",
    description: "Domain registration status, registrar, dates, and nameservers via RDAP (lite fields only)",
    price: "$0.008",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "domain", required: true, description: "Domain e.g. example.com" },
    ],
    handler: whoisLiteHandler,
    discovery: {
      exampleQuery: { domain: "example.com" },
      exampleOutput: {
        service: "whois-lite",
        ok: true,
        domain: "example.com",
        registrar: "RESERVED-Internet Assigned Numbers Authority",
        source: "rdap",
      },
    },
  },
  {
    slug: "fx-rate",
    name: "FX rates",
    description: "Live fiat FX rates (Frankfurter/ECB primary, open.er-api fallback) for cross-border agents",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "base", required: false, description: "ISO 4217 base, default USD" },
      { name: "symbols", required: false, description: "Comma list e.g. EUR,GBP,JPY" },
    ],
    handler: fxRateHandler,
    discovery: {
      exampleQuery: { base: "USD", symbols: "EUR,GBP" },
      exampleOutput: {
        service: "fx-rate",
        ok: true,
        base: "USD",
        rates: { EUR: 0.92, GBP: 0.79 },
        source: "frankfurter.dev (ECB)",
      },
    },
  },
  {
    slug: "redirect-trace",
    name: "Redirect trace",
    description: "Follow a public redirect chain with per-hop HTTP status (SSRF-safe) for security agents",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "url", required: true, description: "Starting https:// URL" },
      { name: "max_hops", required: false, description: "1–10, default 10" },
    ],
    handler: redirectTraceHandler,
    discovery: {
      exampleQuery: { url: "https://httpbin.org/redirect/1" },
      exampleOutput: {
        service: "redirect-trace",
        ok: true,
        hop_count: 2,
        final_status: 200,
      },
    },
  },
];

for (const s of VENDING_SERVICES) {
  assertPriceWithinCap(s.price);
}

export const SERVICES_BY_SLUG = Object.fromEntries(
  VENDING_SERVICES.filter((s) => s.enabled).map((s) => [s.slug, s]),
) as Record<string, VendingService>;
