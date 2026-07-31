"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { TerminalBox } from "@/components/terminal-box";

export type CatalogService = {
  slug: string;
  name: string;
  description: string;
  price: string;
  category: "bundle" | "premium" | "atom";
  /** Required query params, shown in the atoms table. */
  params: string;
  /** API path, e.g. /api/v/dns-resolve?domain=base.org */
  path: string;
  /** Ready-to-copy curl example with the PAYMENT-SIGNATURE header. */
  curl: string;
};

type Filter = "all" | "bundle" | "premium" | "atom";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bundle", label: "Bundles" },
  { key: "premium", label: "Premium" },
  { key: "atom", label: "Utilities" },
];

/** HTTP-style request preview inside a CRT terminal box; copy grabs full curl. */
function CurlTerminal({ s }: { s: CatalogService }) {
  return (
    <TerminalBox
      title={`x402 call — ${s.slug}`}
      copyText={s.curl}
      payHref={`/pay/${s.slug}`}
      payLabel={`Pay ${s.price} →`}
    >
      <p className="break-all">
        <span className="text-sky-600 dark:text-sky-400">GET</span>{" "}
        <span className="text-gray-700 dark:text-zinc-300">{s.path}</span>
      </p>
      <p className="break-all">
        <span className="text-amber-600/90 dark:text-amber-300/90">PAYMENT-SIGNATURE:</span>{" "}
        <span className="crt-text">&lt;signed x402 payload&gt;</span>
      </p>
      <p className="text-gray-400 dark:text-zinc-600">
        → <span className="crt-text">200 OK</span> · settles only on success
      </p>
    </TerminalBox>
  );
}

function ServiceCard({ s }: { s: CatalogService }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">{s.name}</h3>
        <Link
          href={`/pay/${s.slug}`}
          className="rounded-md bg-emerald-500 px-5 py-2 font-sans text-base font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Pay {s.price} →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{s.description}</p>
      <p className="mt-2 font-mono text-xs text-gray-500 dark:text-zinc-500">GET {s.path}</p>
      <div className="mt-3">
        <CurlTerminal s={s} />
      </div>
    </article>
  );
}

/** Filterable tools catalog: bundles/premium as cards, utility atoms as a table. */
export function Catalog({ services }: { services: CatalogService[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return services.filter((s) => {
      if (filter !== "all" && s.category !== filter) return false;
      if (!needle) return true;
      return (
        s.slug.includes(needle) ||
        s.name.toLowerCase().includes(needle) ||
        s.description.toLowerCase().includes(needle)
      );
    });
  }, [services, filter, q]);

  const bundles = visible.filter((s) => s.category === "bundle");
  const premium = visible.filter((s) => s.category === "premium");
  const atoms = visible.filter((s) => s.category === "atom");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tools…"
          className="w-48 rounded-md border border-gray-200 bg-white/60 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-500/60 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:placeholder:text-zinc-600"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              filter === f.key
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-gray-200 text-gray-600 hover:border-gray-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {bundles.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
            Bundles — one payment, one call, many signals
          </h3>
          <div className="mt-3 grid gap-4">
            {bundles.map((s) => (
              <ServiceCard key={s.slug} s={s} />
            ))}
          </div>
        </section>
      )}

      {premium.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
            Premium
          </h3>
          <div className="mt-3 grid gap-4">
            {premium.map((s) => (
              <ServiceCard key={s.slug} s={s} />
            ))}
          </div>
        </section>
      )}

      {atoms.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
            Utility atoms — click a row for curl
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
                  <th className="px-3 py-2 font-medium">Tool</th>
                  <th className="px-3 py-2 font-medium">Params</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">curl</th>
                </tr>
              </thead>
              <tbody>
                {atoms.map((s) => {
                  const isOpen = expanded === s.slug;
                  return (
                    <Fragment key={s.slug}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : s.slug)}
                        className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50/60 dark:border-zinc-800/60 dark:hover:bg-zinc-900/60"
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono text-gray-800 dark:text-zinc-200">{s.slug}</span>
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                            {s.description}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-zinc-400">
                          {s.params || "—"}
                        </td>
                        <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">{s.price}</td>
                        <td className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">
                          {isOpen ? "hide ▴" : "curl ▾"}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-gray-100 dark:border-zinc-800/60">
                          <td colSpan={4} className="bg-gray-50/80 px-3 py-3 dark:bg-zinc-950/60">
                            <CurlTerminal s={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visible.length === 0 && <p className="mt-6 text-sm text-gray-500 dark:text-zinc-500">No tools match "{q}".</p>}
    </div>
  );
}
