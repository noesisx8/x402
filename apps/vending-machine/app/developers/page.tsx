import Link from "next/link";

const repository = "https://github.com/noesisx8/x402/tree/feat/x402-reliability-playground/apps/vending-machine/agent-kit";
export const metadata = { title: "Agent integration | VendSDK", description: "Connect an agent to VendSDK with explicit USDC budgets and x402 price quotes." };

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900 dark:text-zinc-100">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">BUILD WITH VENDSDK</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Give your agent a budget.</h1>
      <p className="mt-5 max-w-2xl text-lg text-gray-600 dark:text-zinc-400">Discover a tool, check its price, then authorize a call. The agent kit connects JavaScript, Python and MCP clients to VendSDK through x402.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={repository} className="rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-500">Get the agent kit</a>
        <Link href="/test" className="rounded-lg border border-gray-300 px-5 py-3 dark:border-zinc-700">Try the playground</Link>
      </div>
      <section className="mt-12 grid gap-4 sm:grid-cols-3" aria-label="Integration steps">
        {[
          ["1. Discover", "Search the catalog and read the service inputs before making a request."],
          ["2. Quote", "A 402 response supplies the current price. Checking a price never pays."],
          ["3. Authorize", "Each paid call must fit your call cap and the remaining session budget."],
        ].map(([title, description]) => <article key={title} className="rounded-xl border border-gray-200 p-5 dark:border-zinc-800"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{description}</p></article>)}
      </section>
      <section className="mt-12" aria-labelledby="quickstart">
        <h2 id="quickstart" className="text-2xl font-semibold">Start with a price quote</h2>
        <p className="mt-3 text-gray-600 dark:text-zinc-400">After cloning the repository, run the example with Node 22 or later. No wallet is required.</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-5 text-sm text-emerald-200"><code>{"cd apps/vending-machine/agent-kit\nnpm ci --ignore-scripts\nnpm run example\n\n# Python uses the same payment client\npython example.py"}</code></pre>
      </section>
      <section className="mt-10 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <h2 className="text-xl font-semibold">You control spending</h2>
        <p className="mt-3 text-gray-600 dark:text-zinc-300">Payments start disabled. Enable them on your payer host with a fixed merchant, network, per-call cap and session cap. The agent cannot raise those limits. An uncertain payment stops further purchases until an operator reviews it.</p>
        <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">Budgets apply to one running process. Restarting starts a new allowance. Store wallet keys on the payer host; never enter them in this website.</p>
      </section>
      <section id="receipts" className="mt-10 rounded-xl border border-gray-200 p-6 dark:border-zinc-800">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">PAYMENT RECOVERY</p>
        <h2 className="mt-2 text-2xl font-semibold">Recover a result without paying again.</h2>
        <p className="mt-3 text-gray-600 dark:text-zinc-300">Enable receipts before a purchase. If the connection drops, your agent can retrieve the saved result once payment is confirmed. A pending outcome stays pending until it can be verified.</p>
        <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
          <li>Results are retained for 24 hours, up to 128 KiB per call.</li>
          <li>Recovery requires your receipt access token. Keep it with your payment records.</li>
          <li>Recovery never starts another payment or resets your spending allowance.</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500 dark:text-zinc-400">Available for supported USDC authorizations when durable storage is configured. Enable it in the agent kit; existing calls do not automatically receive receipts.</p>
        <div className="mt-5 flex flex-wrap gap-5 text-sm text-emerald-700 dark:text-emerald-400">
          <a className="underline" href={`${repository}/../RECEIPTS.md`}>Receipt setup and recovery</a>
          <a className="underline" href="/api/receipts">Check receipt availability</a>
        </div>
      </section>
      <nav className="mt-10 flex flex-wrap gap-5 text-sm text-emerald-700 dark:text-emerald-400" aria-label="Developer references">
        <a className="underline" href="/api/openapi.json">OpenAPI reference</a>
        <a className="underline" href="/.well-known/agent-services.json">Agent catalog</a>
        <a className="underline" href={`${repository}/README.md`}>MCP setup and examples</a>
      </nav>
    </main>
  );
}
