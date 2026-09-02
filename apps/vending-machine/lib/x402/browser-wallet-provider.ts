"use client";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isBraveWallet?: boolean;
  providers?: Eip1193Provider[];
  on?: (event: string, listener: (accounts: string[]) => void) => void;
  removeListener?: (event: string, listener: (accounts: string[]) => void) => void;
  selectedAddress?: string | null;
};

/**
 * Prefer Brave Wallet when multiple injected EIP-1193 providers share window.ethereum.
 * Other browsers keep using their primary injected provider unchanged.
 */
export function getBrowserWalletProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;

  const ethereum = (window as typeof window & { ethereum?: Eip1193Provider }).ethereum;
  if (!ethereum) return undefined;

  return ethereum.providers?.find((provider) => provider.isBraveWallet) ?? ethereum;
}
