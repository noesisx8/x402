/**
 * CDP Bazaar (x402 discovery layer) helpers.
 * Quality signals: description, input schema, output schema, examples.
 * @see https://docs.cdp.coinbase.com/x402/bazaar
 */
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { VendingService } from "@/lib/services/types";

type JsonSchemaProps = Record<string, Record<string, unknown>>;

/**
 * Build Bazaar discovery extension for a GET utility route.
 * Forces stable routeTemplate `/api/v/{slug}` so dynamic Next `[slug]` does not
 * collapse to `:var1` (hurts discovery quality).
 */
export function bazaarExtensionsForService(svc: VendingService): Record<string, unknown> {
  const properties: JsonSchemaProps = {};
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
        .map((p) => [p.name, "example"]),
    );

  const exampleOutput =
    svc.discovery?.exampleOutput ??
    ({
      service: svc.slug,
      ok: true,
    } as Record<string, unknown>);

  // Always publish a typed output schema (quality signal on Agentic.Market)
  const outputProps: JsonSchemaProps =
    (svc.discovery?.outputSchema as JsonSchemaProps | undefined) ??
    Object.fromEntries(
      Object.keys(exampleOutput).map((k) => {
        const v = exampleOutput[k];
        if (typeof v === "number") return [k, { type: "number" }];
        if (typeof v === "boolean") return [k, { type: "boolean" }];
        if (Array.isArray(v)) return [k, { type: "array" }];
        if (v !== null && typeof v === "object") return [k, { type: "object" }];
        return [k, { type: "string" }];
      }),
    );

  const declared = declareDiscoveryExtension({
    input: exampleQuery,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
    output: {
      example: exampleOutput,
      schema: {
        type: "object",
        properties: outputProps,
      },
    },
  }) as {
    bazaar?: {
      info?: Record<string, unknown>;
      schema?: Record<string, unknown>;
      routeTemplate?: string;
    };
  };

  // Pin route template to real public path (avoid Next.js [slug] → :var1)
  if (declared.bazaar) {
    declared.bazaar.routeTemplate = `/api/v/${svc.slug}`;
  }

  return declared as Record<string, unknown>;
}
