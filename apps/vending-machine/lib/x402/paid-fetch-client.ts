"use client";

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

export type ClientNetworkConfig = {
  networkMode: "base" | "base-sepolia";
  caipNetwork: `eip155:${number}`;
  chainName: string;
  hint: string;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getProvider(): Eip1193Provider {
  const eth = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
  if (!eth) {
    throw new Error("No browser wallet found. Install MetaMask or Coinbase Wallet.");
  }
  return eth;
}

function chainForMode(mode: ClientNetworkConfig["networkMode"]) {
  return mode === "base" ? base : baseSepolia;
}

/** Connect wallet and switch to the app's configured Base network. */
export async function connectBrowserWallet(config: ClientNetworkConfig): Promise<Address> {
  const provider = getProvider();
  const chain = chainForMode(config.networkMode);
  const client = createWalletClient({ chain, transport: custom(provider) });
  const [address] = await client.requestAddresses();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chain.id.toString(16)}` }],
    });
  } catch (e) {
    const err = e as { code?: number };
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: chain.blockExplorers
              ? [chain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    } else {
      throw e;
    }
  }
  return address;
}

function signerFromWallet(address: Address, config: ClientNetworkConfig) {
  const provider = getProvider();
  const chain = chainForMode(config.networkMode);
  const client = createWalletClient({ chain, transport: custom(provider) });
  return {
    address,
    signTypedData: async (parameters: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      client.signTypedData({
        account: address,
        domain: parameters.domain as Parameters<typeof client.signTypedData>[0]["domain"],
        types: parameters.types as Parameters<typeof client.signTypedData>[0]["types"],
        primaryType: parameters.primaryType as Parameters<typeof client.signTypedData>[0]["primaryType"],
        message: parameters.message as Parameters<typeof client.signTypedData>[0]["message"],
      }) as Promise<Hex>,
  };
}

export async function paidGet(
  url: string,
  address: Address,
  config: ClientNetworkConfig,
): Promise<Response> {
  const signer = signerFromWallet(address, config);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: config.caipNetwork,
        client: new ExactEvmScheme(signer),
      },
      {
        network: "eip155:*",
        client: new ExactEvmScheme(signer),
      },
    ],
  });
  return fetchWithPayment(url, { method: "GET" });
}