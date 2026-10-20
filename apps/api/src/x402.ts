import type { Express, Request } from "express";
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

/**
 * Verb-wildcard keys. "GET /v1/dns" does not match HEAD, and Express runs the
 * GET handler for HEAD, which previously skipped payment entirely.
 */
export function buildRoutes(env: X402Env): RoutesConfig {
  const network = NETWORK_CAIP[env.network];
  return {
    "/v1/dns": {
      accepts: {
        scheme: "exact",
        price: "$0.003",
        network,
        payTo: env.payTo,
      },
      description: "DNS A/AAAA lookup for a hostname",
      mimeType: "application/json",
    },
    "/v1/http-head": {
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

/** Same verb rule as @x402/core parseRoutePattern: no verb means every method. */
export function sdkRouteMatches(pattern: string, path: string, method: string): boolean {
  const [verb, routePath] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
  if (verb.toUpperCase() !== "*" && verb.toUpperCase() !== method.toUpperCase()) return false;
  const normalized = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const source = routePath.replace(/[.+?^${}()|[\]\\*]/g, "\\$&").replace(/\\\*/g, ".*?");
  return new RegExp(`^${source}$`, "i").test(normalized);
}

export function routeRequiresPayment(env: X402Env, path: string, method: string): boolean {
  return Object.keys(buildRoutes(env)).some((pattern) => sdkRouteMatches(pattern, path, method));
}

export function paymentHeaderOf(req: Request): string {
  return (req.header("payment-signature") || req.header("x-payment") || "").trim();
}

/**
 * Attach x402 paywall. Call only on Railway / portalv2 (X402_ENABLED=true).
 */
export async function attachX402(app: Express, env: X402Env): Promise<void> {
  const network = NETWORK_CAIP[env.network];
  const facilitatorClient = new HTTPFacilitatorClient({ url: env.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactEvmScheme(),
  );
  await resourceServer.initialize();

  const routes = buildRoutes(env);
  app.use(paymentMiddleware(routes, resourceServer));
}
