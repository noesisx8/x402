import type { RouteConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import { assertPriceWithinCap } from "@/lib/pricing";
import { bazaarExtensionsForService } from "@/lib/x402/bazaar";

export type VendingHandler = (
  request: Request,
  query: Record<string, string | string[] | undefined>
) => Promise<Record<string, unknown>>;

export type VendingDiscovery = {
  /** Example query params for Bazaar (must validate against inputSchema). */
  exampleQuery: Record<string, string>;
  /** Example JSON body agents should expect. */
  exampleOutput: Record<string, unknown>;
  /** Optional property map for output JSON Schema. */
  outputSchema?: Record<string, unknown>;
};

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
  /** CDP Bazaar discovery metadata (optional but recommended). */
  discovery?: VendingDiscovery;
};

export function serviceRouteConfig(svc: VendingService): RouteConfig {
  assertPriceWithinCap(svc.price);
  const network: Network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  // Keep description ≤ 500 chars (CDP facilitator hard limit)
  const description = svc.description.slice(0, 500);

  return {
    accepts: {
      scheme: svc.scheme,
      price: svc.price,
      network,
      payTo: serverEnv.X402_PAY_TO_ADDRESS,
      maxTimeoutSeconds: 120,
    },
    description,
    mimeType: "application/json",
    // Bazaar: declare input/output so CDP can catalog after first settle
    extensions: bazaarExtensionsForService(svc),
  };
}

export function serviceApiPath(slug: string): string {
  return `/api/v/${slug}`;
}
