/**
 * VENDING MACHINE REGISTRY
 * Add a service: append one object below — path, price, handler.
 * Paid route auto-exposed at GET /api/v/{slug}
 */
import {
  cryptoPricesHandler,
  emailValidateHandler,
  ipLookupHandler,
  qrGeneratorHandler,
  weatherHandler,
} from "@/lib/services/handlers";
import type { VendingService } from "@/lib/services/types";

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
];

export const SERVICES_BY_SLUG = Object.fromEntries(
  VENDING_SERVICES.filter((s) => s.enabled).map((s) => [s.slug, s])
) as Record<string, VendingService>;