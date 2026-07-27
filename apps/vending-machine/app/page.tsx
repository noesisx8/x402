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
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative mt-16 border-t border-emerald-300/10 pt-10">
      <div className="absolute -left-8 top-16 h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      <p className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-300/90">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p> : null}
      <div className="mt-7 grid gap-5 lg:grid-cols-3">{children}</div>
    </section>
  );
}
function StatPill({
  label,
  value,
  detail,
  tone = "emerald",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "emerald" | "cyan";
}) {
  const glow =
    tone === "cyan"
      ? "group-hover:border-cyan-300/30 group-hover:shadow-cyan-400/10"
      : "group-hover:border-emerald-300/30 group-hover:shadow-emerald-400/10";

  return (
    <div
      className={`group rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4 shadow-2xl shadow-black/20 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.065] ${glow}`}
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
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
          <div className="absolute right-8 top-0 h-[30rem] w-[30rem] rounded-full bg-emerald-400/16 blur-[130px]" />
          <div className="absolute left-1/3 top-40 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/8 blur-[120px]" />
          <div className="absolute bottom-20 left-0 h-72 w-72 rounded-full bg-lime-300/10 blur-[100px]" />
        </div>

        <section className="relative min-h-[80vh] overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#050505]/90 p-px shadow-[0_0_90px_rgba(16,185,129,0.18)] backdrop-blur">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(16,185,129,0.28),transparent_28%,transparent_72%,rgba(34,211,238,0.18))]" />
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
          <div className="relative grid min-h-[80vh] gap-10 rounded-[2rem] bg-[radial-gradient(ellipse_80%_50%_at_70%_-20%,rgba(34,197,94,0.14),transparent),linear-gradient(135deg,rgba(10,10,10,0.96),rgba(5,5,5,0.99))] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.20)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                X402 V2 · BASE BUNDLER HUB
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl lg:text-7xl">
                Agent-grade APIs.
                <span className="block bg-gradient-to-r from-emerald-200 via-cyan-100 to-lime-200 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(16,185,129,0.22)]">
                  One USDC payment.
                </span>
                <span className="block">Live settlement.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                Pay once. Call any of {enabled.length} HTTP utilities + AI research bundles on Base.
                No accounts. Failed handlers close safely before settlement.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href="/test"
                  className="group relative overflow-hidden rounded-2xl bg-emerald-300 px-6 py-3 font-semibold text-zinc-950 shadow-[0_0_38px_rgba(16,185,129,0.35)] transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-200 hover:shadow-[0_0_62px_rgba(16,185,129,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:translate-x-full" />
                  <span className="relative">Pay 0.01 USDC → Unlock tools</span>
                </Link>
                <Link
                  href="/.well-known/agent-services.json"
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-zinc-200 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-300/[0.07] hover:text-emerald-100 hover:shadow-[0_0_28px_rgba(16,185,129,0.14)]"
                >
                  Agent Catalog
                </Link>
                <Link
                  href="/api/openapi.json"
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-zinc-200 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.07] hover:text-cyan-100 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)]"
                >
                  OpenAPI Spec
                </Link>
              </div>
            </div>

            <div className="relative rounded-[1.75rem] border border-white/10 bg-black/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur transition duration-300 hover:border-emerald-300/20 hover:shadow-[0_24px_90px_rgba(16,185,129,0.14)]">
              <div className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-emerald-300/20 via-transparent to-cyan-300/20 opacity-80" />
              <div className="relative space-y-5">
                <div className="rounded-3xl border border-emerald-300/25 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.24),transparent_42%),rgba(16,185,129,0.10)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_45px_rgba(16,185,129,0.10)]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200">LIVE SETTLEMENT</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                      ONLINE
                    </span>
                  </div>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-50">{enabled.length} tools online</p>
                  <p className="mt-2 text-sm text-zinc-400">Network {network}</p>
                  <p className="mt-3 text-xs text-zinc-500">Settlement guard active</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatPill label="Bundles" value={String(bundles.length)} detail="Multi-signal" />
                  <StatPill label="Premium" value={String(premium.length)} detail="Research" tone="cyan" />
                  <StatPill label="Utilities" value={String(atoms.length)} detail="HTTP" />
                  <StatPill label="Mode" value="x402" detail="Settlement" tone="cyan" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Section
          title="Bundles for multi-signal agents"
          eyebrow="GO-TO ENDPOINTS"
          description="Pre-composed tool groups. Pay once, call many."
        >
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
