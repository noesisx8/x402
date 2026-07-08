import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { getResourceServer } from "@/lib/x402/resource-server";
import { SERVICES_BY_SLUG } from "@/lib/services/registry";
import { serviceRouteConfig } from "@/lib/services/types";
import { logCall } from "@/lib/analytics";

type Wrapped = (request: NextRequest) => Promise<NextResponse>;

const wrappedHandlers: Record<string, Wrapped> = {};

async function ensureWrapped(slug: string): Promise<Wrapped | null> {
  const svc = SERVICES_BY_SLUG[slug];
  if (!svc) return null;
  if (wrappedHandlers[slug]) return wrappedHandlers[slug];

  const server = await getResourceServer();
  const inner = async (request: NextRequest) => {
    const started = Date.now();
    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    try {
      const body = await svc.handler(request, query);
      await logCall({ slug, ok: true, ms: Date.now() - started });
      return NextResponse.json({ service: slug, ok: true, ...body });
    } catch (e) {
      await logCall({ slug, ok: false, ms: Date.now() - started, error: String(e) });
      return NextResponse.json({ service: slug, ok: false, error: String(e) }, { status: 400 });
    }
  };

  wrappedHandlers[slug] = withX402(inner, serviceRouteConfig(svc), server) as unknown as Wrapped;
  return wrappedHandlers[slug];
}

/**
 * Dynamic vending route: x402 flow is 402 → pay → retry → verify/settle → 200.
 * Settlement runs only after handler returns status < 400 (withX402 guarantee).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const handler = await ensureWrapped(slug);
  if (!handler) {
    return NextResponse.json({ error: "unknown_service", slug }, { status: 404 });
  }
  return handler(request);
}