import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

let resourceServer: x402ResourceServer | null = null;
let initPromise: Promise<x402ResourceServer> | null = null;

/**
 * Shared x402 resource server (facilitator verify/settle).
 * Initialized once per serverless isolate; safe to reuse across routes.
 */
export function getResourceServer(): Promise<x402ResourceServer> {
  if (resourceServer) return Promise.resolve(resourceServer);
  if (!initPromise) {
    initPromise = (async () => {
      const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
      const facilitator = new HTTPFacilitatorClient({ url: serverEnv.X402_FACILITATOR_URL });
      const server = new x402ResourceServer(facilitator).register(network, new ExactEvmScheme());
      await server.initialize();
      resourceServer = server;
      return server;
    })();
  }
  return initPromise;
}