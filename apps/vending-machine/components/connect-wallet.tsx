"use client";

import { useState, useEffect, useCallback } from "react";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function getEthereum(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum;
}

export function ConnectWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if already connected
    const eth = getEthereum();
    if (eth?.selectedAddress) {
      setAddress(eth.selectedAddress);
    }

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] ?? null);
    };

    eth?.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      eth?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setLoading(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0] ?? null);
    } catch {
      // User rejected
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 opacity-60 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        Connect wallet
      </button>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-sm font-mono font-medium text-emerald-700 dark:text-emerald-300">
          {truncateAddress(address)}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 dark:text-emerald-300 dark:focus:ring-offset-zinc-950"
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting…
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          Connect wallet
        </span>
      )}
    </button>
  );
}
