/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { VendingService } from "@/lib/services/types";

type EndpointCardProps = {
  service: VendingService;
  baseUrl: string;
  featured?: boolean;
};

function requiredQueryHint(service: VendingService): string {
  const required = service.queryParams.filter((p) => p.required);
  if (required.length === 0) return "";
  return `?${required.map((p) => `${p.name}=…`).join("&")}`;
}

function trustAssetUrl(kind: "badge" | "card", resourceUrl: string): string {
  const encoded = encodeURIComponent(resourceUrl);
  return `https://x402.fuchss.app/${kind}.svg?resource=${encoded}`;
}

function markdownImage(label: string, imageUrl: string): string {
  return `![${label}](${imageUrl})`;
}

function categoryLabel(service: VendingService): string {
  if (service.category === "bundle") return "Bundle";
  if (service.category === "premium") return "Premium";
  return "Utility";
}

export function EndpointCard({ service, baseUrl, featured = false }: EndpointCardProps) {
  const endpointPath = `/api/v/${service.slug}`;
  const resourceUrl = `${baseUrl.replace(/\/$/, "")}${endpointPath}`;
  const trustCard = trustAssetUrl("card", resourceUrl);
  const trustBadge = trustAssetUrl("badge", resourceUrl);

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl border bg-zinc-950/70 shadow-2xl shadow-black/20 transition",
        "hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-emerald-950/30",
        featured ? "border-emerald-500/30" : "border-zinc-800",
      ].join(" ")}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
              {categoryLabel(service)}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
              {service.price} USDC
            </span>
            <img
              src={trustBadge}
              alt={`x402 trust grade for ${service.slug}`}
              loading="lazy"
              className="h-6 rounded"
            />
          </div>

          <h3 className="mt-4 text-xl font-semibold text-zinc-50">{service.name}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{service.description}</p>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Endpoint URL</p>
            <code className="mt-1 block break-all font-mono text-xs text-zinc-300">
              GET {endpointPath}{requiredQueryHint(service)}
            </code>
          </div>

          {service.queryParams.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {service.queryParams.map((param) => (
                <span
                  key={param.name}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-400"
                  title={param.description}
                >
                  {param.name}
                  {param.required ? <span className="text-amber-300"> required</span> : null}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/test?slug=${encodeURIComponent(service.slug)}`}
              className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-950 transition hover:bg-emerald-300"
            >
              Test payment
            </Link>
            <Link
              href={endpointPath}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Open endpoint
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
            Current x402 trust grade + key stats
          </p>
          <a
            href={trustCard}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open x402 trust card for ${service.slug}`}
          >
            <img
              src={trustCard}
              alt={`x402 trust card for ${resourceUrl}`}
              loading="lazy"
              className="w-full rounded-xl bg-zinc-950"
            />
          </a>
        </div>
      </div>
    </article>
  );
}

export function DirectoryMaintainerSnippet({ baseUrl }: { baseUrl: string }) {
  const sampleResource = `${baseUrl.replace(/\/$/, "")}/api/v/dns-records`;
  const badge = trustAssetUrl("badge", sampleResource);
  const card = trustAssetUrl("card", sampleResource);
  const cardMarkdown = markdownImage("x402 trust card: grade and key stats", card);
  const badgeHtml = `<img src="${badge}" alt="x402 trust grade">`;

  return (
    <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-400">
            For directory maintainers
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
            Show the current grade and key stats from x402.fuchss.app.
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Listing lots of endpoints? Skip the per-endpoint lookup: drop the resource URL you
            already have into the badge or card template. No ID, no API call. The card image is
            supplied by x402.fuchss.app and auto-updates as the score refreshes.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Example endpoint page:{" "}
            <a className="text-emerald-400 underline" href="https://x402.fuchss.app/endpoint/85243">
              x402.fuchss.app/endpoint/85243
            </a>{" "}
            for <code className="text-zinc-300">{sampleResource}</code>.
          </p>
          <div className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-black/30 p-3 font-mono text-[11px] text-zinc-400">
            <div>
              <p className="mb-1 font-sans text-[11px] uppercase tracking-wide text-zinc-500">
                Badge HTML
              </p>
              <p className="break-all">{badgeHtml}</p>
            </div>
            <div>
              <p className="mb-1 font-sans text-[11px] uppercase tracking-wide text-zinc-500">
                Card Markdown (grade + key stats)
              </p>
              <p className="break-all">{cardMarkdown}</p>
            </div>
          </div>
        </div>
        <a href={card} target="_blank" rel="noreferrer" aria-label="Open x402 trust card example">
          <img
            src={card}
            alt="x402 trust card example for dns-records"
            loading="lazy"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900"
          />
        </a>
      </div>
    </section>
  );
}
