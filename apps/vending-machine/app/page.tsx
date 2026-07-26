import type { ReactNode } from "react";
import Link from "next/link";
import { EndpointCard } from "@/components/endpoint-card";
import { SiteFooter } from "@/components/site-footer";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import type { VendingCategory, VendingService } from "@/lib/services/types";

function categoryOf(s: VendingService): VendingCategory {
  return s.category ?? "atom";
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="relative mt-16">
      <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl" />
      <p className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-300/90">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h2>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

export default function HomePage() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  const enabled = VENDING_SERVICES.filter((s) => s.enabled);
  const bundles = enabled.filter((s) => categoryOf(s) === "bundle");
  const premium = enabled.filter((s) => categoryOf(s) === "premium");
  const atoms = enabled.filter((s) => categoryOf(s) === "atom");

  return (
    <>
      <main className="relative isolate mx-auto max-w-7xl overflow-hidden px-6 py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[120px]" />
          <div className="absolute right-0 top-48 h-80 w-80 rounded-full bg-cyan-400/10 blur-[110px]" />
          <div className="absolute bottom-20 left-0 h-72 w-72 rounded-full bg-lime-300/10 blur-[100px]" />
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-zinc-950/80 p-px shadow-[0_0_80px_rgba(16,185,129,0.16)] backdrop-blur">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(16,185,129,0.28),transparent_28%,transparent_72%,rgba(34,211,238,0.18))]" />
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
          <div className="relative grid gap-8 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-6 sm:p-10 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.20)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                x402 V2 · Base bundler hub
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl lg:text-7xl">
                Multi-step agent jobs.
                <span className="block bg-gradient-to-r from-emerald-200 via-cyan-100 to-lime-200 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(16,185,129,0.22)]">
                  One USDC payment.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                Pay-per-call HTTP utilities and AI-ready research tools, settled in USDC on Base — no
                accounts required. Live upstream only, fail-closed with no settlement on handler errors.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/test"
                  className="rounded-2xl bg-emerald-300 px-5 py-3 font-semibold text-zinc-950 shadow-[0_0_38px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:bg-emerald-200 hover:shadow-[0_0_54px_rgba(16,185,129,0.45)]"
                >
                  Try wallet payment
                </Link>
                <Link
                  href="/.well-known/agent-services.json"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-zinc-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-white/[0.07]"
                >
                  Agent catalog
                </Link>
                <Link
                  href="/api/openapi.json"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-zinc-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.07]"
                >
                  OpenAPI
                </Link>
              </div>
            </div>

            <div className="relative rounded-3xl border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-emerald-300/20 via-transparent to-cyan-300/20 opacity-80" />
              <div className="relative space-y-4">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200">Live settlement</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-50">{enabled.length} tools</p>
                  <p className="mt-1 text-sm text-zinc-400">Network {network}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatPill label="Bundles" value={String(bundles.length)} />
                  <StatPill label="Premium" value={String(premium.length)} />
                  <StatPill label="Utilities" value={String(atoms.length)} />
                  <StatPill label="Mode" value="x402" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Section title="Bundles for multi-signal agents" eyebrow="Go-to endpoints">
          {bundles.map((s) => (
            <EndpointCard key={s.slug} service={s} featured />
          ))}
        </Section>

        {premium.length > 0 && (
          <Section title="Premium research tools" eyebrow="Higher-value calls">
            {premium.map((s) => (
              <EndpointCard key={s.slug} service={s} />
            ))}
            <p className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-4 text-xs leading-5 text-zinc-500">
              Kronos forecast outputs are generated by an open-source model and are not financial
              advice, investment recommendations, or trading signals. Accuracy is not guaranteed. Read
              the{" "}
              <Link className="text-emerald-300 underline" href="/disclaimer">
                Research Disclaimer
              </Link>
              .
            </p>
          </Section>
        )}

        <Section title="Utility atoms" eyebrow="Single-purpose paid endpoints">
          {atoms.map((s) => (
            <EndpointCard key={s.slug} service={s} />
          ))}
        </Section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400 shadow-2xl shadow-black/20 backdrop-blur">
          <p>
            Discovery:{" "}
            <Link className="text-emerald-300 underline" href="/.well-known/agent-services.json">
              agent-services.json
            </Link>
            ,{" "}
            <Link className="text-emerald-300 underline" href="/.well-known/x402">
              x402
            </Link>
            ,{" "}
            <Link className="text-emerald-300 underline" href="/api/openapi.json">
              OpenAPI
            </Link>
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Micropayments are final when settled. Use is subject to our{" "}
            <Link className="underline hover:text-zinc-400" href="/terms">
              Terms
            </Link>
            , including{" "}
            <Link className="underline hover:text-zinc-400" href="/terms#acceptable-use">
              Acceptable Use
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
