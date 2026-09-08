import { parameterSchema, outputSchema } from "@/lib/services/contracts";
import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv } from "@/lib/env";

export async function GET() {
  const base = serverEnv.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const paths: Record<string, unknown> = {};
  const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: {
      type: "object", required: ["error"], properties: {
        error: { type: "string" }, retryable: { type: "boolean" },
      },
    } } },
  });
  for (const s of VENDING_SERVICES.filter((svc) => svc.enabled)) {
    paths[`/api/v/${s.slug}`] = {
      get: {
        operationId: s.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
        tags: [s.category ?? "atom"],
        summary: s.name,
        description: s.description,
        parameters: s.queryParams.map((p) => ({
          name: p.name, in: "query", required: !!p.required,
          description: p.description,
          schema: parameterSchema(s.slug, p.name),
          example: parameterSchema(s.slug,p.name).type === "integer" ? Number(s.discovery?.exampleQuery[p.name]) || parameterSchema(s.slug,p.name).default : s.discovery?.exampleQuery[p.name],
        })),
        responses: {
          "200": {
            description: "Paid JSON payload",
            headers: { "PAYMENT-RESPONSE": { description: "Base64 x402 settlement response", schema: { type: "string" } } },
            content: { "application/json": {
              schema: outputSchema(s),
              example: s.discovery?.exampleOutput,
            } },
          },
          "400": errorResponse("Invalid input; handler failure does not settle payment"),
          "402": {
            description: "Inspect PAYMENT-REQUIRED, then use an x402 client to sign and retry the same URL",
            headers: { "PAYMENT-REQUIRED": { description: "Base64 x402 payment requirements", schema: { type: "string" } } },
          },
          "429": { ...errorResponse("Rate limited"), headers: { "Retry-After": { schema: { type: "string" }, description: "Seconds before retrying" } } },
          "502": errorResponse("Upstream or payment pipeline failure; check settlement before a new payment"),
          "503": errorResponse("Service unavailable"),
          "504": errorResponse("Upstream timeout; handler failure does not settle payment"),
        },
        "x-x402-price": s.price,
      },
    };
  }
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "VendSDK API", version: "0.2.0" },
    servers: [{ url: base }], paths,
  });
}
