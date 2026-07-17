import Link from "next/link";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import type { VendingCategory, VendingService } from "@/lib/services/types";

function categoryOf(s: VendingService): VendingCategory {
  return s.category ?? "atom";
}

function ServiceCard({ s }: { s: VendingService }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-medium">{s.name}</h3>
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
  );
}

export default function HomePage() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  const enabled = VENDING_SERVICES.filter((s) => s.enabled);
  const bundles = enabled.filter((s) => categoryOf(s) === "bundle");
  const premium = enabled.filter((s) => categoryOf(s) === "premium");
  const atoms = enabled.filter((s) => categoryOf(s) === "atom");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest text-emerald-400">x402 V2 · Base bundler hub</p>
      <h1 className="mt-2 text-3xl font-semibold">Multi-step agent jobs. One USDC payment.</h1>
      <p className="mt-3 text-zinc-400">
        Network {network} · exact USDC · micropayments are final (no refunds).{" "}
        {enabled.length} live tools — bundles first, live upstream only, fail-closed (no settle on
        handler errors).
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-100">Bundles (go-to)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Prefer these when agents need multiple signals in one 402.
        </p>
        <div className="mt-4 grid gap-4">
          {bundles.map((s) => (
            <ServiceCard key={s.slug} s={s} />
          ))}
        </div>
      </section>

      {premium.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-zinc-100">Premium</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Higher-value research tools. Forecasts are not financial advice.
          </p>
          <div className="mt-4 grid gap-4">
            {premium.map((s) => (
              <ServiceCard key={s.slug} s={s} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-100">Utilities (atoms)</h2>
        <p className="mt-1 text-sm text-zinc-500">Single-purpose paid endpoints.</p>
        <div className="mt-4 grid gap-4">
          {atoms.map((s) => (
            <ServiceCard key={s.slug} s={s} />
          ))}
        </div>
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
        <p className="text-xs text-zinc-600">
          Kronos forecasts are research-only outputs from an open model; not investment advice.
        </p>
      </section>
    </main>
  );
}
