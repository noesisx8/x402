#!/usr/bin/env node
/**
 * Phase 0.2 paid E2E — run ONLY on a deploy host / throwaway machine with a funded key.
 * Never commit private keys. Never run production paid smoke on the daily-driver by default.
 *
 * Env:
 *   X402_PRIVATE_KEY   0x… EVM private key with Base USDC
 *   BASE_URL           default https://vending-machine-seven.vercel.app
 *   SLUG               default qr-code
 *   QUERY              default data=paid-e2e
 *
 * Example (portalv2):
 *   X402_PRIVATE_KEY=0x… node scripts/paid-fetch.mjs
 */

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const BASE = (process.env.BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(/\/$/, "");
const SLUG = process.env.SLUG ?? "qr-code";
const QUERY = process.env.QUERY ?? "data=paid-e2e";
const pk = process.env.X402_PRIVATE_KEY?.trim();

if (!pk) {
  console.error("Set X402_PRIVATE_KEY (0x…) with Base mainnet USDC. Aborting.");
  process.exit(2);
}

const account = privateKeyToAccount(/** @type {`0x${string}`} */ (pk));
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const signer = {
  address: account.address,
  signTypedData: (params) => walletClient.signTypedData(params),
};

const fetchPaid = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    { network: "eip155:8453", client: new ExactEvmScheme(signer) },
    { network: "eip155:*", client: new ExactEvmScheme(signer) },
  ],
});

const url = `${BASE}/api/v/${SLUG}?${QUERY}`;
console.log(`Payer ${account.address}`);
console.log(`GET ${url}`);

const res = await fetchPaid(url, { method: "GET" });
const text = await res.text();
const paymentResponse =
  res.headers.get("payment-response") ?? res.headers.get("PAYMENT-RESPONSE");

console.log(`HTTP ${res.status}`);
if (paymentResponse) console.log(`PAYMENT-RESPONSE length=${paymentResponse.length}`);
console.log(text.slice(0, 2000));

if (res.status !== 200) {
  console.error("Paid E2E failed — expected 200 after settle.");
  process.exit(1);
}
console.log("Paid E2E OK.");
