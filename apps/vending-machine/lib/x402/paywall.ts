import { createPaywall, type PaywallConfig, type PaywallProvider } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { serverEnv } from "@/lib/env";

let paywall: PaywallProvider | null = null;

export function getPaywallProvider(): PaywallProvider {
  if (!paywall) {
    paywall = createPaywall()
      .withNetwork(evmPaywall)
      .withConfig(paywallConfig())
      .build();
  }
  return paywall;
}

export function paywallConfig(currentUrl?: string): PaywallConfig {
  const base = (serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(
    /\/$/,
    "",
  );
  return {
    appName: "x402 Vending Machine",
    appLogo: `${base}/vendorbuddy.png`,
    currentUrl: currentUrl?.startsWith("/") ? `${base}${currentUrl}` : currentUrl,
    testnet: serverEnv.X402_NETWORK_MODE !== "base",
  };
}
