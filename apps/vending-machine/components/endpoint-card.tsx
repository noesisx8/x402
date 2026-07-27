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

function includedTools(service: VendingService): string[] {
  const bySlug: Record<string, string[]> = {
    "bundle-infra": ["DNS", "HTTP HEAD", "TLS cert"],
    "bundle-outbound": ["Email", "IP geo", "HTTP HEAD"],
    "domain-intel": ["DNS", "TLS", "RDAP", "HTTP HEAD"],
  };

  return bySlug[service.slug] ?? service.queryParams.slice(0, 4).map((param) => param.name);
}

export function EndpointCard({ service, featured = false }: EndpointCardProps) {
  const endpointPath = `/api/v/${service.slug}`;
  const requiredCount = service.queryParams.filter((p) => p.required).length;
  const tools = includedTools(service);

  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-3xl border border-emerald-300/25 bg-zinc-950/70 p-px shadow-2xl shadow-black/25 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-[0_0_54px_rgba(16,185,129,0.18)]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-300/14 via-transparent to-cyan-300/10 opacity-0 transition duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
        <div className="relative flex h-full flex-col rounded-3xl bg-[linear-gradient(135deg,rgba(24,24,27,0.90),rgba(9,9,11,0.96))] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
              {categoryLabel(service)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              {service.price} USDC
            </span>
          </div>

          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50">{service.name}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{service.description}</p>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Includes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tools.slice(0, 4).map((tool) => (
                <span
                  key={tool}
                  className="rounded-xl border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs text-zinc-300"
                >
                  {tool}
                </span>
              ))}
              {tools.length > 4 ? (
                <span className="rounded-xl border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs text-zinc-500">
                  +{tools.length - 4} more
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/test?slug=${encodeURIComponent(service.slug)}`}
              className="rounded-xl bg-emerald-300 px-4 py-2.5 font-semibold text-zinc-950 shadow-[0_0_28px_rgba(16,185,129,0.24)] transition hover:bg-emerald-200 hover:shadow-[0_0_44px_rgba(16,185,129,0.36)]"
            >
              Try bundle
            </Link>
            <Link
              href={endpointPath}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-zinc-200 transition hover:border-emerald-300/40 hover:bg-white/[0.07]"
            >
              View API
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-3xl border bg-zinc-950/70 p-px shadow-2xl shadow-black/25 backdrop-blur transition duration-300",
        "hover:-translate-y-1 hover:shadow-[0_0_54px_rgba(16,185,129,0.18)]",
        featured ? "border-emerald-300/30" : "border-white/10 hover:border-emerald-300/25",
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-300/14 via-transparent to-cyan-300/10 opacity-0 transition duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      <div className="relative grid gap-5 rounded-3xl bg-[linear-gradient(135deg,rgba(24,24,27,0.90),rgba(9,9,11,0.96))] p-5 md:grid-cols-[1fr_230px] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
              {categoryLabel(service)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              {service.price} USDC
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">{service.name}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{service.description}</p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-3 shadow-inner shadow-black/30">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Endpoint URL</p>
            <code className="mt-2 block break-all font-mono text-xs text-emerald-100/90">
              GET {endpointPath}{requiredQueryHint(service)}
            </code>
          </div>

          {service.queryParams.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {service.queryParams.map((param) => (
                <span
                  key={param.name}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400"
                  title={param.description}
                >
                  {param.name}
                  {param.required ? <span className="text-amber-200"> required</span> : null}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/test?slug=${encodeURIComponent(service.slug)}`}
              className="rounded-xl bg-emerald-300 px-4 py-2.5 font-semibold text-zinc-950 shadow-[0_0_28px_rgba(16,185,129,0.24)] transition hover:bg-emerald-200 hover:shadow-[0_0_44px_rgba(16,185,129,0.36)]"
            >
              Test payment
            </Link>
            <Link
              href={endpointPath}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-zinc-200 transition hover:border-emerald-300/40 hover:bg-white/[0.07]"
            >
              Open endpoint
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/25">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Payment route</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            {service.price}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.20em] text-zinc-500">USDC per call</p>
          <div className="mt-5 space-y-3 text-xs text-zinc-400">
            <div className="flex justify-between gap-3 border-t border-white/10 pt-3">
              <span>Method</span>
              <span className="font-mono text-zinc-100">GET</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-3">
              <span>Mode</span>
              <span className="text-zinc-100">x402</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-3">
              <span>Required params</span>
              <span className="text-right text-zinc-100">{requiredCount || "None"}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
