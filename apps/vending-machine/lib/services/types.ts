import type { RouteConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import { assertPriceWithinCap } from "@/lib/pricing";

export type VendingHandler = (
  request: Request,
  query: Record<string, string | string[] | undefined>
) => Promise<Record<string, unknown>>;

export type VendingService = {
  slug: string;
  name: string;
  description: string;
  /** Display price e.g. $0.003 — passed to x402 accepts */
  price: string;
  scheme: "exact" | "upto";
  enabled: boolean;
  queryParams: { name: string; required?: boolean; description?: string }[];
  handler: VendingHandler;
};

export function serviceRouteConfig(svc: VendingService): RouteConfig {
  // Phase 0.5: fail closed if a route is mis-priced above the global cap
  assertPriceWithinCap(svc.price);
  const network: Network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  return {
    accepts: {
      scheme: svc.scheme,
      price: svc.price,
      network,
      payTo: serverEnv.X402_PAY_TO_ADDRESS,
      maxTimeoutSeconds: 120,
    },
    description: svc.description,
    mimeType: "application/json",
  };
}

export function serviceApiPath(slug: string): string {
  return `/api/v/${slug}`;
}
