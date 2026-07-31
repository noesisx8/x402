/**
 * "How it works" — animated settlement flow. Server component, zero client
 * JS: every effect is CSS (hover lift, neon underlight, traveling packet).
 *
 * The illusion: each card sits slightly raised off the page black; a
 * breathing neon glow lives underneath it (staggered 1→2→3 so the light
 * appears to travel the settlement path). On hover the card lifts higher,
 * its underlight flares to full brightness, and it looks like it's hovering
 * above a neon strip. Between cards, a packet of light rides a rail —
 * request → signature → settlement.
 */

type Step = {
  chip: string;
  tag: string;
  tagClass: string;
  title: string;
  body: React.ReactNode;
  glowDelay: string;
};

function FlowConnector({ delay }: { delay: string }) {
  return (
    <>
      {/* Horizontal rail (sm and up) */}
      <div aria-hidden className="relative hidden h-px w-10 shrink-0 self-center sm:block lg:w-16">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0" />
        <span
          className="how-packet-x absolute top-1/2 -ml-1 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)]"
          style={{ animationDelay: delay }}
        />
      </div>
      {/* Vertical rail (mobile) */}
      <div aria-hidden className="relative mx-auto h-10 w-px shrink-0 sm:hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/0 via-emerald-500/50 to-emerald-500/0" />
        <span
          className="how-packet-y absolute left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)]"
          style={{ animationDelay: delay }}
        />
      </div>
    </>
  );
}

function FlowCard({ step }: { step: Step }) {
  return (
    <article className="group relative flex-1">
      {/* Neon underlight — breathes on a stagger; flares on hover */}
      <div
        aria-hidden
        className="how-underglow absolute inset-x-6 -bottom-3 h-10 rounded-full bg-emerald-500/40 blur-xl transition-opacity duration-500 group-hover:[animation:none] group-hover:opacity-90"
        style={{ animationDelay: step.glowDelay }}
      />
      {/* Halo wash behind the lifted card */}
      <div
        aria-hidden
        className="absolute -inset-1 -z-10 rounded-xl bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative h-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:border-emerald-500/50 group-hover:bg-zinc-900 group-hover:shadow-[0_24px_60px_-16px_rgba(16,185,129,0.45)]">
        <div className="flex items-center justify-between">
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-400">
            {step.chip}
          </span>
          <span className={`font-mono text-xs ${step.tagClass}`}>{step.tag}</span>
        </div>
        <h3 className="mt-3 font-medium text-zinc-100">{step.title}</h3>
        <div className="mt-1 text-sm text-zinc-400">{step.body}</div>
      </div>
    </article>
  );
}

export function HowItWorks({ network }: { network: string }) {
  const steps: Step[] = [
    {
      chip: "01",
      tag: "402",
      tagClass: "text-amber-300",
      title: "Request an endpoint",
      body: (
        <>
          Hit any tool URL. If unpaid, the server responds{" "}
          <span className="font-mono text-zinc-300">402 Payment Required</span> with a{" "}
          <span className="font-mono text-zinc-300">Payment-Required</span> header carrying the
          exact USDC price, pay-to address, and network.
        </>
      ),
      glowDelay: "0s",
    },
    {
      chip: "02",
      tag: "EIP-3009",
      tagClass: "text-sky-400",
      title: "Sign with your wallet",
      body: (
        <>
          Your wallet (or agent) signs a USDC{" "}
          <span className="font-mono text-zinc-300">transferWithAuthorization</span> on {network}.
          No account creation, no API keys, no custody.
        </>
      ),
      glowDelay: "2s",
    },
    {
      chip: "03",
      tag: "200 OK",
      tagClass: "crt-text",
      title: "Retry with proof",
      body: (
        <>
          Resend the request with the{" "}
          <span className="font-mono text-zinc-300">PAYMENT-SIGNATURE</span> header. The facilitator
          verifies and settles on-chain; data returns in the same response.
        </>
      ),
      glowDelay: "4s",
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-col items-stretch sm:flex-row">
        <FlowCard step={steps[0]} />
        <FlowConnector delay="0.8s" />
        <FlowCard step={steps[1]} />
        <FlowConnector delay="2.1s" />
        <FlowCard step={steps[2]} />
      </div>
      <p className="mt-5 text-center font-mono text-xs text-zinc-600">
        <span className="text-emerald-500/70">●</span> watch the packet ride the settlement path —
        request → signature → settled
      </p>
    </div>
  );
}
