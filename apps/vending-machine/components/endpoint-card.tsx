import Link from "next/link";
import type { VendingService } from "@/lib/services/types";

type EndpointCardProps = {
  service: VendingService;
  featured?: boolean;
};

function requiredQueryHint(service: VendingService): string {
  const required = service.queryParams.filter((p) => p.required);
  if (required.length === 0) return "";
  return `?${required.map((p) => `${p.name}=…`).join("&")}`;
}

function categoryLabel(service: VendingService): string {
  if (service.category === "bundle") return "Bundle";
  if (service.category === "premium") return "Premium";
  return "Utility";
}

export function EndpointCard({ service, featured = false }: EndpointCardProps) {
  const endpointPath = `/api/v/${service.slug}`;

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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Payment route</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">{service.price}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">USDC per call</p>
          <div className="mt-4 space-y-2 text-xs text-zinc-400">
            <div className="flex justify-between gap-3 border-t border-zinc-800 pt-3">
              <span>Method</span>
              <span className="font-mono text-zinc-200">GET</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-zinc-800 pt-3">
              <span>Mode</span>
              <span className="text-zinc-200">x402</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-zinc-800 pt-3">
              <span>Required params</span>
              <span className="text-right text-zinc-200">
                {service.queryParams.filter((p) => p.required).length || "None"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
