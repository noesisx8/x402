"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  connectBrowserWallet,
  paidGet,
  type ClientNetworkConfig,
} from "@/lib/x402/paid-fetch-client";

export type PayService = {
  slug: string;
  name: string;
  description: string;
  price: string;
  category: string;
  /** Example query string from the registry (editable). */
  qs: string;
};

/**
 * Dedicated per-tool payment flow: connect an EVM wallet, sign the x402
 * payment, and call the tool. Mirrors the /test playground but locked to a
 * single service.
 */
export function PayClient({ service }: { service: PayService }) {
  const [qs, setQs] = useState(service.qs);
  const [out, setOut] = useState("");
  const [config, setConfig] = useState<ClientNetworkConfig | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [paidActivity, setPaidActivity] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/client", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setConfig(j as ClientNetworkConfig))
      .catch(() => setOut("Failed to load /api/config/client"));
  }, []);

  const url = `/api/v/${service.slug}${qs ? `?${qs}` : ""}`;

  const callUnpaid = useCallback(async () => {
    setBusy(true);
    setPaidActivity(null);
    setFailure(null);
    setOut("Loading…");
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      setOut(`HTTP ${res.status}\n${text}`);
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }, [url]);

  const connect = useCallback(async () => {
    if (!config) return;
    setBusy(true);
    setPaidActivity(null);
    setFailure(null);
    setOut("Connecting wallet…");
    try {
      const addr = await connectBrowserWallet(config);
      setAddress(addr);
      setOut(`Connected: ${addr}\nNetwork: ${config.chainName}\n${config.hint}`);
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }, [config]);

  const callPaid = useCallback(async () => {
    if (!config || !address) {
      setOut("Connect wallet first.");
      return;
    }
    setBusy(true);
    setFailure(null);
    setPaidActivity(`Waiting for wallet signature, then ${service.name} will run. Keep this page open.`);
    setOut(`402 → sign ${service.price} USDC in wallet → retry…`);
    try {
      const res = await paidGet(url, address, config);
      setPaidActivity("Payment submitted. Vercel is verifying settlement and running the service…");
      const paymentResponse =
        res.headers.get("payment-response") ?? res.headers.get("PAYMENT-RESPONSE");
      const text = await res.text();
      let extra = "";
      if (paymentResponse) {
        extra = `\n\n(settlement header present, length ${paymentResponse.length})`;
      } else if (res.status === 402) {
        extra = "\n\nStill 402: not settled. Approve USDC in wallet and keep the query unchanged.";
      }
      const output = `HTTP ${res.status}\n${text}${extra}`;
      setOut(output);
      if (!res.ok) {
        setFailure(output);
      }
    } catch (e) {
      const message = `Paid call failed:\n${String(e)}`;
      setFailure(message);
      setOut(message);
    } finally {
      setBusy(false);
      setPaidActivity(null);
    }
  }, [address, config, url, service.name, service.price]);

  return (
    <div>
      <label className="block text-sm text-gray-800 dark:text-zinc-200">
        Query string
        <input
          className="mt-1 w-full rounded border border-gray-200 bg-white/60 p-2 font-mono text-xs text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          value={qs}
          onChange={(e) => setQs(e.target.value)}
        />
      </label>
      <p className="mt-1 font-mono text-xs text-gray-500 dark:text-zinc-500">GET {url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={callUnpaid}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          GET (no payment) — always 402
        </button>
        <button
          type="button"
          disabled={busy || !config}
          onClick={connect}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {address ? "Reconnect wallet" : "Connect wallet"}
        </button>
        <button
          type="button"
          disabled={busy || !address}
          onClick={callPaid}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Pay {service.price} &amp; GET
        </button>
      </div>
      {address && (
        <p className="mt-2 font-mono text-xs text-gray-500 dark:text-zinc-500">
          Payer: {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      )}
      {paidActivity && (
        <div
          className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-800 shadow-lg shadow-emerald-950/10 dark:text-emerald-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-ping rounded-full bg-emerald-400" />
            <div>
              <p className="font-medium">Payment in progress</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{paidActivity}</p>
            </div>
          </div>
        </div>
      )}
      {failure && (
        <div
          className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <p className="font-semibold">Something didn&apos;t work</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs text-red-900 dark:text-red-100">
            {failure}
          </pre>
        </div>
      )}
      <pre className="mt-6 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50/80 p-4 text-xs text-gray-800 dark:border-zinc-800 dark:bg-black/40 dark:text-zinc-200">
        {out || "Connect a wallet with USDC, then Pay & GET."}
      </pre>
    </div>
  );
}
