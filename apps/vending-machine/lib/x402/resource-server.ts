import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import {
  createCdpFacilitatorAuthHeaders,
  shouldUseCdpFacilitatorAuth,
} from "@/lib/x402/cdp-auth";

let resourceServer: x402ResourceServer | null = null;
let initPromise: Promise<x402ResourceServer> | null = null;

/**
 * Shared x402 resource server (facilitator verify/settle + CDP Bazaar extension).
 * Initialized once per serverless isolate; safe to reuse across routes.
 */
export function getResourceServer(): Promise<x402ResourceServer> {
  if (resourceServer) return Promise.resolve(resourceServer);
  if (!initPromise) {
    initPromise = (async () => {
      const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
      const useCdpAuth = shouldUseCdpFacilitatorAuth(
        serverEnv.X402_FACILITATOR_URL,
        serverEnv.CDP_API_KEY_ID,
        serverEnv.CDP_API_KEY_SECRET,
      );

      const facilitator = new HTTPFacilitatorClient({
        url: serverEnv.X402_FACILITATOR_URL,
        ...(useCdpAuth
          ? {
              createAuthHeaders: () =>
                createCdpFacilitatorAuthHeaders(
                  serverEnv.CDP_API_KEY_ID!,
                  serverEnv.CDP_API_KEY_SECRET!,
                ),
            }
          : {}),
      });

      const server = new x402ResourceServer(facilitator)
        .register(network, new ExactEvmScheme())
        // CDP Bazaar: enrich Payment-Required with discovery metadata for cataloging
        .registerExtension(bazaarResourceServerExtension);

      await server.initialize();
      resourceServer = server;
      return server;
    })();
  }
  return initPromise;
}
