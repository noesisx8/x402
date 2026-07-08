"use client";

import { useState } from "react";

const SERVICES = [
  { slug: "qr-code", qs: "data=https://x402.org" },
  { slug: "crypto-prices", qs: "ids=bitcoin,ethereum" },
  { slug: "weather", qs: "city=Berlin" },
  { slug: "email-validate", qs: "email=test@example.com" },
];

export default function TestPage() {
  const [slug, setSlug] = useState(SERVICES[0].slug);
  const [qs, setQs] = useState(SERVICES[0].qs);
  const [out, setOut] = useState("");

  async function call() {
    setOut("Loading…");
    const res = await fetch(`/api/v/${slug}?${qs}`);
    const text = await res.text();
    setOut(`HTTP ${res.status}\n${text}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">x402 client smoke test</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Unpaid calls return 402 with PAYMENT-REQUIRED. Use an x402-capable wallet client or agent to
        pay and retry. This page only shows raw HTTP for debugging.
      </p>
      <label className="mt-6 block text-sm">
        Service
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2"
          value={slug}
          onChange={(e) => {
            const pick = SERVICES.find((s) => s.slug === e.target.value);
            setSlug(e.target.value);
            if (pick) setQs(pick.qs);
          }}
        >
          {SERVICES.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.slug}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Query string
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs"
          value={qs}
          onChange={(e) => setQs(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={call}
        className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
      >
        Send GET (no payment)
      </button>
      <pre className="mt-6 overflow-auto rounded border border-zinc-800 bg-black/40 p-4 text-xs">
        {out}
      </pre>
    </main>
  );
}