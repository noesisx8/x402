/**
 * CDP Bazaar (x402 discovery layer) helpers.
 * @see https://docs.cdp.coinbase.com/x402/bazaar
 */
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { VendingService } from "@/lib/services/types";

/**
 * Build Bazaar discovery extension for a GET utility route.
 * CDP indexes this metadata after the first successful settle through CDP facilitator.
 */
export function bazaarExtensionsForService(svc: VendingService): Record<string, unknown> {
  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];
  for (const p of svc.queryParams) {
    properties[p.name] = {
      type: "string",
      description: p.description ?? p.name,
    };
    if (p.required) required.push(p.name);
  }

  const exampleQuery =
    svc.discovery?.exampleQuery ??
    Object.fromEntries(
      svc.queryParams
        .filter((p) => p.required)
        .map((p) => [p.name, p.description?.includes("e.g.") ? "example" : "value"]),
    );

  const exampleOutput =
    svc.discovery?.exampleOutput ??
    ({
      service: svc.slug,
      ok: true,
    } as Record<string, unknown>);

  // declareDiscoveryExtension returns { bazaar: { info, schema } }
  return declareDiscoveryExtension({
    input: exampleQuery,
    inputSchema: {
      properties,
      ...(required.length ? { required } : {}),
    },
    output: {
      example: exampleOutput,
      ...(svc.discovery?.outputSchema
        ? { schema: { properties: svc.discovery.outputSchema } }
        : {}),
    },
  }) as Record<string, unknown>;
}
