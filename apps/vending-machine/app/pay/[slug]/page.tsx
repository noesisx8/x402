import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PayClient } from "@/components/pay-client";
import { SiteFooter } from "@/components/site-footer";
import { TerminalBox } from "@/components/terminal-box";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serviceApiPath } from "@/lib/services/types";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

type Params = { slug: string };

function findService(slug: string) {
  return VENDING_SERVICES.find((s) => s.slug === slug && s.enabled);
}

export function generateStaticParams(): Params[] {
  return VENDING_SERVICES.filter((s) => s.enabled).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = findService(slug);
  return {
    title: svc ? `Pay ${svc.price} — ${svc.name} · x402 Vending Machine` : "x402 Vending Machine",
    description: svc?.description,
  };
}

export default async function PayPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const svc = findService(slug);
  if (!svc) notFound();

  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  const origin = serverEnv.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  const example = svc.discovery?.exampleQuery ?? {};
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(example).map(([k, v]) => [k, String(v)]))
  ).toString();
  const path = serviceApiPath(svc.slug) + (qs ? `?${qs}` : "");
  const curl = `curl -X GET "${origin}${path}" \\\n  -H "PAYMENT-SIGNATURE: <signed x402 payload>"`;

  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm">
          <Link className="text-emerald-400 underline" href="/#tools">
            ← All tools
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">{svc.name}</h1>
          <span className="text-xl text-emerald-400">{svc.price} USDC</span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">{svc.description}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {svc.category ?? "atom"} · settled in USDC on {network} · failed calls never settle
        </p>

        <div className="mt-6">
          <PayClient
            service={{
              slug: svc.slug,
              name: svc.name,
              description: svc.description,
              price: svc.price,
              category: svc.category ?? "atom",
              qs,
            }}
          />
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Prefer curl or an agent?
          </h2>
          <div className="mt-2">
            <TerminalBox title={`x402 call — ${svc.slug}`} copyText={curl}>
              <p className="break-all">
                <span className="text-sky-400">GET</span>{" "}
                <span className="text-zinc-300">{path}</span>
              </p>
              <p className="break-all">
                <span className="text-amber-300/90">PAYMENT-SIGNATURE:</span>{" "}
                <span className="crt-text">&lt;signed x402 payload&gt;</span>
              </p>
              <p className="text-zinc-600">
                → <span className="crt-text">200 OK</span> · settles only on success
              </p>
            </TerminalBox>
          </div>
        </div>

        {svc.slug === "kronos-forecast" && (
          <p className="mt-6 text-xs text-zinc-500">
            <strong className="text-zinc-400">Research only.</strong> Kronos outputs are not
            financial advice or trading signals.{" "}
            <Link className="text-emerald-400 underline" href="/disclaimer">
              Full disclaimer →
            </Link>
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
