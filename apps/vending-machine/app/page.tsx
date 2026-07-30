import Link from "next/link";
import { Catalog, type CatalogService } from "@/components/catalog";
import { CopyButton } from "@/components/copy-button";
import { SettlementTicker } from "@/components/settlement-ticker";
import { TerminalBox } from "@/components/terminal-box";
import { SiteFooter } from "@/components/site-footer";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serviceApiPath } from "@/lib/services/types";
import { CAIP_NETWORK, isPlaceholderPayTo, serverEnv } from "@/lib/env";

const GITHUB_URL = "https://github.com/noesisx8/x402";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function basescanAddressUrl(addr: string): string {
  const base =
    serverEnv.X402_NETWORK_MODE === "base" ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${base}/address/${addr}`;
}

function toCatalogService(
  s: (typeof VENDING_SERVICES)[number],
  origin: string
): CatalogService {
  const example = s.discovery?.exampleQuery ?? {};
  const qs = new URLSearchParams(example).toString();
  const path = serviceApiPath(s.slug) + (qs ? `?${qs}` : "");
  const curl = `curl -X GET "${origin}${path}" \\\n  -H "PAYMENT-SIGNATURE: <signed x402 payload>"`;
  return {
    slug: s.slug,
    name: s.name,
    description: s.description,
    price: s.price,
    category: s.category ?? "atom",
    params: s.queryParams
      .filter((p) => p.required)
      .map((p) => p.name)
      .join(", "),
    path,
    curl,
  };
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200 marker:hidden">
        <span className="mr-2 inline-block transition group-open:rotate-90">▶</span>
        {q}
      </summary>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </details>
  );
}

export default function HomePage() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  const origin = serverEnv.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  const enabled = VENDING_SERVICES.filter((s) => s.enabled);
  const services = enabled.map((s) => toCatalogService(s, origin));
  const payTo = serverEnv.X402_PAY_TO_ADDRESS;
  const payToReal = !isPlaceholderPayTo(payTo);

  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          x402 micropayments · settled on Base
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Agent-grade APIs. One USDC payment. Live settlement.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          {enabled.length} pay-per-call endpoints for agents and developers. No accounts, no API
          keys, no subscriptions — your wallet signature is the auth. Every endpoint is a plain GET,
          priced in USDC on {network}, and failed calls never settle.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <a
            href="#tools"
            className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400"
          >
            Browse {enabled.length} tools ↓
          </a>
          <Link className="text-emerald-400 underline" href="/api/openapi.json">
            OpenAPI spec ↗
          </Link>
          <a className="text-emerald-400 underline" href={GITHUB_URL}>
            GitHub ↗
          </a>
          <Link className="text-emerald-400 underline" href="/test">
            Live client test →
          </Link>
        </div>
        {payToReal && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">settlement address {truncateAddress(payTo)}</span>
            <CopyButton text={payTo} />
            <a className="text-emerald-400 underline" href={basescanAddressUrl(payTo)}>
              View on Basescan ↗
            </a>
            <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-emerald-400">
              settlement guard active
            </span>
          </div>
        )}

        {/* Live settlement ticker */}
        <section className="mt-10" aria-label="Recent settlements">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Recent settlements
            </h2>
            <span className="text-xs text-zinc-600">live · refreshes every 15s</span>
          </div>
          <SettlementTicker />
        </section>

        {/* How it works */}
        <section id="how" className="mt-14 scroll-mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">How it works</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pay → prove → call. Three steps, no signup.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-emerald-400">1</p>
              <h3 className="mt-1 font-medium">Request an endpoint</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Hit any tool URL. If unpaid, the server responds{" "}
                <span className="font-mono text-zinc-300">402 Payment Required</span> with a{" "}
                <span className="font-mono text-zinc-300">Payment-Required</span> header carrying
                the exact USDC price, pay-to address, and network.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-emerald-400">2</p>
              <h3 className="mt-1 font-medium">Sign with your wallet</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Your wallet (or agent) signs a USDC{" "}
                <span className="font-mono text-zinc-300">transferWithAuthorization</span> (EIP-3009)
                on {network}. No account creation, no API keys, no custody.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-emerald-400">3</p>
              <h3 className="mt-1 font-medium">Retry with proof</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Resend the request with the{" "}
                <span className="font-mono text-zinc-300">PAYMENT-SIGNATURE</span> header. The
                facilitator verifies and settles on-chain; data returns in the same response.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <TerminalBox title="x402 handshake — dns-resolve">
              <p className="break-all">
                <span className="text-sky-400">GET</span>{" "}
                <span className="text-zinc-300">/api/v/dns-resolve?domain=base.org</span>{" "}
                <span className="text-zinc-600">→</span>{" "}
                <span className="text-amber-300">402 Payment Required</span>
              </p>
              <p className="break-all pl-4 text-zinc-500">
                Payment-Required: {"{ "}price: "$0.003", payTo: "
                {payToReal ? truncateAddress(payTo) : "<pay-to>"}", network: "{network}"{" }"}
              </p>
              <p className="mt-2 crt-text">
                wallet signs USDC transferWithAuthorization → facilitator verifies + settles
                on-chain
              </p>
              <p className="mt-2 break-all">
                <span className="text-sky-400">GET</span>{" "}
                <span className="text-zinc-300">/api/v/dns-resolve?domain=base.org</span>{" "}
                <span className="text-zinc-600">+</span>{" "}
                <span className="text-amber-300/90">PAYMENT-SIGNATURE:</span>{" "}
                <span className="text-zinc-500">&lt;signed x402 payload&gt;</span>{" "}
                <span className="text-zinc-600">→</span> <span className="crt-text">200 OK</span>{" "}
                <span className="text-zinc-500">{`{ "A": ["…"], "AAAA": ["…"] }`}</span>
              </p>
            </TerminalBox>
          </div>
        </section>

        {/* Catalog */}
        <section id="tools" className="mt-14 scroll-mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">Tools &amp; bundles</h2>
          <p className="mt-1 text-sm text-zinc-500">
            All endpoints are GET · paid via x402 · priced in USDC on Base — shown once here instead
            of on every card.
          </p>
          <div className="mt-4">
            <Catalog services={services} />
          </div>
        </section>

        {/* Trust / on-chain proof */}
        <section id="proof" className="mt-14 scroll-mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">On-chain proof, not promises</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {payToReal && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Settlement address
                </dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-sm text-zinc-200">
                  {truncateAddress(payTo)}
                  <CopyButton text={payTo} />
                  <a
                    className="font-sans text-xs text-emerald-400 underline"
                    href={basescanAddressUrl(payTo)}
                  >
                    Basescan ↗
                  </a>
                </dd>
              </div>
            )}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <dt className="text-xs uppercase tracking-wider text-zinc-500">Network</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">{network}</dd>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <dt className="text-xs uppercase tracking-wider text-zinc-500">Currency</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">USDC</dd>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <dt className="text-xs uppercase tracking-wider text-zinc-500">Failed calls</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                never settle — payment finalizes only when the handler succeeds
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <dt className="text-xs uppercase tracking-wider text-zinc-500">Source</dt>
              <dd className="mt-1 text-sm">
                <a className="text-emerald-400 underline" href={GITHUB_URL}>
                  github ↗
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-14 scroll-mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">Questions, answered</h2>
          <div className="mt-4 grid gap-3">
            <Faq q="What is x402?">
              x402 is an open payment protocol that revives the HTTP 402 Payment Required status
              code. Instead of accounts and API keys, each request carries a USDC micropayment on
              Base. Your wallet signature is the authentication — there is nothing to register and
              nothing to leak.
            </Faq>
            <Faq q="What happens if a call fails?">
              Handlers signal bad input or upstream failure with a ≥400 response, which cancels
              settlement before it reaches the facilitator. The USDC stays in your wallet — you are
              only ever charged for successful responses.
            </Faq>
            <Faq q="Do I need an account or API key?">
              No. Connect any EVM wallet with USDC on Base and sign per call — or let your agent
              sign programmatically with @x402/fetch. There are no subscriptions, no tiers, and no
              keys to rotate.
            </Faq>
            <Faq q="What is a bundle?">
              One payment, one request, many signals: a bundle route fans out to several upstream
              checks server-side (e.g. the Infra bundle returns DNS + HTTP HEAD + TLS certificate
              in a single call) and returns one aggregated JSON. Cheaper and faster than paying per
              atom.
            </Faq>
            <Faq q="How do agents discover these endpoints?">
              Machine-readable catalogs are published at /.well-known/agent-services.json,
              /.well-known/x402, /api/openapi.json, and /llms.txt, and services are indexed on the
              CDP Bazaar after their first settlement.
            </Faq>
            <Faq q="Is Kronos Forecast financial advice?">
              No. Kronos output is research-only — a probabilistic short-horizon candle forecast
              from an open-source model. Accuracy is not guaranteed; never trade on it alone. See
              the Research Disclaimer.
            </Faq>
          </div>
        </section>

        {/* Discovery + legal footnote */}
        <section className="mt-14 space-y-2 text-sm text-zinc-400">
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
            ,{" "}
            <Link className="text-emerald-400 underline" href="/llms.txt">
              llms.txt
            </Link>
          </p>
          <p className="text-xs text-zinc-600">
            Kronos forecasts are research-only outputs from an open model; not investment advice.{" "}
            <Link className="underline hover:text-zinc-400" href="/disclaimer">
              Research Disclaimer
            </Link>
            . Use is subject to our{" "}
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
