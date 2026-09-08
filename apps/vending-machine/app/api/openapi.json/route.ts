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
        parameters: [{ name: "X-VendSDK-Receipt", in: "header", required: false, description: "Opt-in recovery: client-generated secret 32-byte lowercase hex token, saved before payment. Requires configured durable storage and exact EIP-3009 USDC. Never place in URLs.", schema: { type: "string", pattern: "^[a-f0-9]{64}$" } }, ...s.queryParams.map((p) => ({
          name: p.name, in: "query", required: !!p.required,
          description: p.description,
          schema: parameterSchema(s.slug, p.name),
          example: parameterSchema(s.slug,p.name).type === "integer" ? Number(s.discovery?.exampleQuery[p.name]) || parameterSchema(s.slug,p.name).default : s.discovery?.exampleQuery[p.name],
        }))],
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
          "202": { description: "Receipt outcome pending. Do not create another payment; use POST /api/receipts." },
          "409": errorResponse("Receipt binding conflict, failed execution or authorization already in use"),
          "410": errorResponse("Receipt result expired; do not automatically pay again"),
          "413": errorResponse("Result exceeds receipt storage limit; settlement not started"),
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
  paths["/api/receipts"] = {
    get: { operationId: "receiptAvailability", summary: "Read receipt configuration and retention limits", responses: { "200": { description: "Configuration availability, not a storage health guarantee" } } },
    post: { operationId: "recoverReceipt", summary: "Recover or reconcile a receipt without another payment", security: [{ ReceiptToken: [] }],
      parameters: [{ name: "X-VendSDK-Transaction", in: "header", required: false, description: "Optional known transaction for pending-settlement reconciliation; requires 12 confirmations and matching USDC events", schema: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" } }],
      responses: { "200": { description: "Confirmed settlement and saved result" }, "202": { description: "Pending: no result released and no payment attempted" }, "400": errorResponse("Invalid token or transaction"), "401": errorResponse("Receipt token required"), "404": errorResponse("Receipt not found"), "409": errorResponse("Failed or unconfirmed receipt"), "410": errorResponse("Result expired"), "429": errorResponse("Rate limited"), "503": errorResponse("Storage or chain evidence unavailable") } },
  };
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "VendSDK API", version: "0.3.0" },
    components: { securitySchemes: { ReceiptToken: { type: "http", scheme: "bearer", description: "Client-generated 32-byte lowercase hex receipt capability. This is not a wallet key or payment signature." } } },
    servers: [{ url: base }], paths,
  });
}
