import { NextResponse } from "next/server";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv } from "@/lib/env";

export const revalidate = 300;

export async function GET() {
  const base = serverEnv.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const paths: Record<string, unknown> = {};
  for (const s of VENDING_SERVICES.filter((svc) => svc.enabled)) {
    paths[`/api/v/${s.slug}`] = {
      get: {
        summary: s.name,
        description: s.description,
        parameters: s.queryParams.map((p) => ({
          name: p.name,
          in: "query",
          required: !!p.required,
          schema: { type: "string" },
        })),
        responses: {
          "200": { description: "Paid JSON payload" },
          "402": { description: "Payment required (x402)" },
        },
        "x-x402-price": s.price,
      },
    };
  }
  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: { title: "x402 Vending Machine", version: "0.1.0" },
      servers: [{ url: base }],
      paths: paths,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
