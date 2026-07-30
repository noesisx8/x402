import { VendingHome } from "@/components/vending-home";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import type { ClientNetworkConfig } from "@/lib/x402/paid-fetch-client";

export default function HomePage() {
  const baseUrl = serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app";
  const mode = serverEnv.X402_NETWORK_MODE;
  const clientConfig: ClientNetworkConfig = {
    networkMode: mode,
    caipNetwork: CAIP_NETWORK[mode],
    chainName: mode === "base" ? "Base Mainnet" : "Base Sepolia",
    hint:
      mode === "base"
        ? "Wallet must be on Base with USDC for micropayments."
        : "Wallet on Base Sepolia with test USDC.",
  };

  return (
    <VendingHome
      baseUrl={baseUrl}
      contractAddress={serverEnv.X402_PAY_TO_ADDRESS}
      network={CAIP_NETWORK[mode]}
      clientConfig={clientConfig}
    />
  );
}
