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

function hueAccent(service: VendingService): string {
  const hues = [
    "from-emerald-300/18 via-cyan-300/10 to-lime-300/14",
    "from-cyan-300/18 via-emerald-300/10 to-teal-300/14",
    "from-lime-300/18 via-emerald-300/10 to-cyan-300/14",
    "from-teal-300/18 via-lime-300/10 to-emerald-300/14",
  ];
  const seed = service.slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hues[seed % hues.length];
}

function EndpointActions({ service, endpointPath }: { service: VendingService; endpointPath: string }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-[145px_minmax(0,1fr)] sm:items-stretch">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-1">
        <Link
          href={`/test?slug=${encodeURIComponent(service.slug)}`}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-300 px-4 py-2.5 text-center font-semibold text-zinc-950 shadow-[0_0_28px_rgba(16,185,129,0.24)] transition duration-300 hover:scale-[1.02] hover:bg-cyan-200 hover:shadow-[0_0_44px_rgba(34,211,238,0.32)]"
        >
          Test payment
        </Link>
        <Link
          href={endpointPath}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center text-zinc-200 transition duration-300 hover:border-lime-300/40 hover:bg-lime-300/[0.06] hover:text-lime-100"
        >
          Open endpoint
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/35 p-3 shadow-inner shadow-black/30 transition duration-300 group-hover:border-cyan-300/25 group-hover:bg-cyan-300/[0.035]">
        <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Endpoint URL</p>
        <code className="mt-2 block break-all font-mono text-xs text-emerald-100/90">
          GET {endpointPath}{requiredQueryHint(service)}
        </code>
      </div>
    </div>
  );
}

export function EndpointCard({ service, featured = false }: EndpointCardProps) {
  const endpointPath = `/api/v/${service.slug}`;
  const requiredCount = service.queryParams.filter((p) => p.required).length;
  const tools = includedTools(service);
  const hue = hueAccent(service);
  const isPremium = service.category === "premium";

  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-3xl border border-emerald-300/25 bg-zinc-950/70 p-px shadow-2xl shadow-black/25 backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-[0_0_54px_rgba(16,185,129,0.18)]">
        <div className={`absolute inset-0 bg-gradient-to-br ${hue} opacity-0 transition duration-500 group-hover:opacity-100 group-hover:hue-rotate-30`} />
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

          <EndpointActions service={service} endpointPath={endpointPath} />
        </div>
      </article>
    );
  }

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-3xl border bg-zinc-950/70 p-px shadow-2xl shadow-black/25 backdrop-blur transition duration-500",
        "hover:-translate-y-1 hover:shadow-[0_0_54px_rgba(16,185,129,0.18)] hover:hue-rotate-15",
        isPremium
          ? "border-emerald-200/35 shadow-[0_0_64px_rgba(16,185,129,0.12)] hover:border-cyan-200/45 hover:shadow-[0_0_82px_rgba(20,184,166,0.18)]"
          : "border-white/10 hover:border-emerald-300/25",
      ].join(" ")}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${isPremium ? "from-emerald-100/18 via-slate-400/12 to-cyan-200/18" : hue} opacity-0 transition duration-500 group-hover:opacity-100 group-hover:hue-rotate-30`}
      />
      <div
        className={[
          "absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          isPremium ? "via-cyan-100/80" : "via-emerald-300/70",
        ].join(" ")}
      />
      <div
        className={[
          "relative grid gap-5 rounded-3xl p-5 md:grid-cols-[minmax(0,1fr)_210px] md:items-start",
          isPremium
            ? "bg-[linear-gradient(135deg,rgba(18,28,26,0.94),rgba(20,22,25,0.96)_45%,rgba(6,10,9,0.98))]"
            : "bg-[linear-gradient(135deg,rgba(24,24,27,0.90),rgba(9,9,11,0.96))]",
        ].join(" ")}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-[0_0_24px_rgba(16,185,129,0.12)]",
                isPremium
                  ? "border-cyan-100/30 bg-gradient-to-r from-emerald-200/15 to-slate-200/10 text-cyan-100"
                  : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
              ].join(" ")}
            >
              {categoryLabel(service)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              {service.price} USDC
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">{service.name}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{service.description}</p>

          {service.queryParams.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {service.queryParams.map((param) => (
                <span
                  key={param.name}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400 transition duration-300 group-hover:border-emerald-300/20 group-hover:text-zinc-300"
                  title={param.description}
                >
                  {param.name}
                  {param.required ? <span className="text-amber-200"> required</span> : null}
                </span>
              ))}
            </div>
          )}

          <EndpointActions service={service} endpointPath={endpointPath} />
        </div>

        <div
          className={[
            "rounded-3xl border p-4 shadow-2xl shadow-black/25",
            isPremium
              ? "border-cyan-100/20 bg-[linear-gradient(145deg,rgba(148,163,184,0.10),rgba(16,185,129,0.08)_45%,rgba(5,5,5,0.40))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_34px_rgba(16,185,129,0.10)]"
              : "border-white/10 bg-white/[0.04]",
          ].join(" ")}
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Payment route</p>
          <p
            className={[
              "mt-3 text-4xl font-semibold drop-shadow-[0_0_20px_rgba(16,185,129,0.25)]",
              isPremium ? "bg-gradient-to-r from-emerald-100 via-cyan-100 to-slate-200 bg-clip-text text-transparent" : "text-emerald-200",
            ].join(" ")}
          >
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
