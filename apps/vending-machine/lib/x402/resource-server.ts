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
 * Wrap Bazaar enrich so Next.js dynamic `/api/v/[slug]` does not collapse
 * routeTemplate to `:var1`. Use the real request path (`/api/v/dns-resolve`).
 */
const bazaarExtensionFixed = {
  key: bazaarResourceServerExtension.key,
  enrichDeclaration: (
    declaration: unknown,
    transportContext: {
      adapter?: { getPath?: () => string };
      method?: string;
      routePattern?: string;
    },
  ) => {
    const base = bazaarResourceServerExtension.enrichDeclaration
      ? bazaarResourceServerExtension.enrichDeclaration(declaration as never, transportContext as never)
      : declaration;
    const path = transportContext?.adapter?.getPath?.() ?? "";
    // Only pin for our vending routes
    if (path.startsWith("/api/v/") && typeof base === "object" && base !== null) {
      const ext = base as { routeTemplate?: string; info?: { input?: Record<string, unknown> } };
      return {
        ...ext,
        routeTemplate: path,
        info: {
          ...ext.info,
          input: {
            ...(ext.info?.input ?? {}),
            // Clear synthetic pathParams from [slug] matching
            pathParams: {},
          },
        },
      };
    }
    return base;
  },
};

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
        .registerExtension(bazaarExtensionFixed as typeof bazaarResourceServerExtension);

      await server.initialize();
      resourceServer = server;
      return server;
    })();
  }
  return initPromise;
}
