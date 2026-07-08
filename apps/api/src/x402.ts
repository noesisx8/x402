import type { Express } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { RoutesConfig } from "@x402/core/server";

import type { Network } from "@x402/core/types";

export type X402Env = {
  payTo: string;
  network: "base" | "base-sepolia";
  facilitatorUrl: string;
};

const NETWORK_CAIP: Record<X402Env["network"], Network> = {
  base: "eip155:8453",
  "base-sepolia": "eip155:84532",
};

export function buildRoutes(env: X402Env): RoutesConfig {
  const network = NETWORK_CAIP[env.network];
  return {
    "GET /v1/dns": {
      accepts: {
        scheme: "exact",
        price: "$0.003",
        network,
        payTo: env.payTo,
      },
      description: "DNS A/AAAA lookup for a hostname",
      mimeType: "application/json",
    },
    "GET /v1/http-head": {
      accepts: {
        scheme: "exact",
        price: "$0.002",
        network,
        payTo: env.payTo,
      },
      description: "HTTP HEAD probe (status, timing, headers subset)",
      mimeType: "application/json",
    },
  };
}

/**
 * Attach x402 paywall. Call only on Railway / portalv2 (X402_ENABLED=true).
 */
export async function attachX402(app: Express, env: X402Env): Promise<void> {
  const network = NETWORK_CAIP[env.network];
  const facilitatorClient = new HTTPFacilitatorClient({ url: env.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactEvmScheme()
  );
  await resourceServer.initialize();

  const routes = buildRoutes(env);
  app.use(paymentMiddleware(routes, resourceServer));
}