import { VendingHome } from "@/components/vending-home";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

export default function HomePage() {
  const baseUrl = serverEnv.PUBLIC_BASE_URL ?? "https://vending-machine-seven.vercel.app";
  return (
    <VendingHome
      baseUrl={baseUrl}
      contractAddress={serverEnv.X402_PAY_TO_ADDRESS}
      network={CAIP_NETWORK[serverEnv.X402_NETWORK_MODE]}
    />
  );
}
