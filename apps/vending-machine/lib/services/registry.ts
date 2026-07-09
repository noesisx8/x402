/**
 * VENDING MACHINE REGISTRY
 * Add a service: append one object below — path, price, handler.
 * Paid route auto-exposed at GET /api/v/{slug}
 *
 * Prices are validated against GLOBAL_MAX_PRICE_USD at wrap time (Phase 0.5).
 */
import {
  bundleInfraHandler,
  cryptoPricesHandler,
  dnsResolveHandler,
  emailValidateHandler,
  httpHeadHandler,
  ipLookupHandler,
  qrGeneratorHandler,
  weatherHandler,
} from "@/lib/services/handlers";
import type { VendingService } from "@/lib/services/types";
import { assertPriceWithinCap } from "@/lib/pricing";

export const VENDING_SERVICES: VendingService[] = [
  {
    slug: "email-validate",
    name: "Email validation",
    description: "Format + disposable-domain heuristics for outreach agents",
    price: "$0.004",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "email", required: true }],
    handler: emailValidateHandler,
  },
  {
    slug: "ip-lookup",
    name: "IP geolocation",
    description: "Country, city, ASN via public geo API",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "ip", required: true }],
    handler: ipLookupHandler,
  },
  {
    slug: "weather",
    name: "Weather snapshot",
    description: "Current temperature and wind for a city (Open-Meteo)",
    price: "$0.003",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "city", required: false, description: "Default London" }],
    handler: weatherHandler,
  },
  {
    slug: "crypto-prices",
    name: "Crypto spot prices",
    description: "USD prices from CoinGecko simple API",
    price: "$0.005",
    scheme: "exact",
    enabled: true,
    queryParams: [{ name: "ids", required: false, description: "Comma-separated CoinGecko ids" }],
    handler: cryptoPricesHandler,
  },
  {
    slug: "qr-code",
    name: "QR code",
    description: "PNG QR for arbitrary payload (agent onboarding, payments)",
    price: "$0.002",
    scheme: "exact",
    enabled: true,
    queryParams: [
      { name: "data", required: true },
      { name: "size", required: false },
    ],
    handler: qrGeneratorHandler,
  },
  // --- Phase 2 hub utilities ---
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
];

// Fail fast at module load if any catalog price is invalid or over the global cap
for (const s of VENDING_SERVICES) {
  assertPriceWithinCap(s.price);
}

export const SERVICES_BY_SLUG = Object.fromEntries(
  VENDING_SERVICES.filter((s) => s.enabled).map((s) => [s.slug, s]),
) as Record<string, VendingService>;
