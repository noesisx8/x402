"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";

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

function ServiceCard({ s }: { s: CatalogService }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-medium">{s.name}</h3>
        <span className="text-emerald-400">{s.price} USDC</span>
      </div>
      <p className="mt-1 text-sm text-zinc-400">{s.description}</p>
      <p className="mt-2 font-mono text-xs text-zinc-500">GET {s.path}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-emerald-400">
          curl example
        </summary>
        <div className="mt-2 flex items-start gap-2">
          <pre className="flex-1 overflow-x-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-400">
            {s.curl}
          </pre>
          <CopyButton text={s.curl} />
        </div>
      </details>
    </article>
  );
}

/** Filterable tools catalog: bundles/premium as cards, utility atoms as a table. */
export function Catalog({ services }: { services: CatalogService[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

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
          className="w-48 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              filter === f.key
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {bundles.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Utility atoms
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Tool</th>
                  <th className="px-3 py-2 font-medium">Params</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">curl</th>
                </tr>
              </thead>
              <tbody>
                {atoms.map((s) => (
                  <tr key={s.slug} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-zinc-200">{s.slug}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{s.description}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{s.params || "—"}</td>
                    <td className="px-3 py-2 text-emerald-400">{s.price}</td>
                    <td className="px-3 py-2">
                      <CopyButton text={s.curl} label="copy curl" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visible.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">No tools match “{q}”.</p>
      )}
    </div>
  );
}
