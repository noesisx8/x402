import Link from "next/link";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

export default function HomePage() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest text-emerald-400">x402 V2 vending machine</p>
      <h1 className="mt-2 text-3xl font-semibold">Pay-per-call utilities for agents</h1>
      <p className="mt-3 text-zinc-400">
        Network {network} · exact USDC · micropayments are final (no refunds).{" "}
        {VENDING_SERVICES.filter((s) => s.enabled).length} live utilities — no mock payloads.
      </p>

      <section className="mt-10 grid gap-4">
        {VENDING_SERVICES.filter((s) => s.enabled).map((s) => (
          <article key={s.slug} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{s.name}</h2>
              <span className="text-emerald-400">{s.price} USDC</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">{s.description}</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              GET /api/v/{s.slug}
              {s.queryParams
                .filter((p) => p.required)
                .map((p) => `?${p.name}=…`)
                .join("")}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 space-y-2 text-sm text-zinc-400">
        <p>
          Discovery:{" "}
          <Link className="text-emerald-400 underline" href="/.well-known/agent-services.json">
            agent-services.json
          </Link>
          ,{" "}
          <Link className="text-emerald-400 underline" href="/.well-known/x402">
            x402
          </Link>
          ,{" "}
          <Link className="text-emerald-400 underline" href="/api/openapi.json">
            OpenAPI
          </Link>
        </p>
        <p>
          Client test:{" "}
          <Link className="text-emerald-400 underline" href="/test">
            /test
          </Link>
        </p>
      </section>
    </main>
  );
}