#!/usr/bin/env node
/**
 * Phase 0.2 paid E2E — run on **portalv2** (ops PC) with a funded key.
 * Never commit private keys.
 * Never run on **pikatop** (daily driver) unless the user explicitly opts in.
 *
 * Env (process env wins over files):
 *   X402_PRIVATE_KEY   0x… EVM private key with Base USDC
 *   BASE_URL           default https://vending-machine-seven.vercel.app
 *   SLUG               default qr-code
 *   QUERY              default data=paid-e2e
 *
 * Files (gitignored; loaded if present, never printed):
 *   apps/vending-machine/.env.local
 *   apps/vending-machine/.env
 *
 * Example (portalv2 PowerShell):
 *   $env:X402_PRIVATE_KEY="0x…"; npm run smoke:paid
 * Or put X402_PRIVATE_KEY=0x… in .env.local then: npm run smoke:paid
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");

/** Load KEY=value from gitignored env files into process.env (no overwrite). */
function loadEnvFile(path) {
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}

const loadedLocal = loadEnvFile(join(appRoot, ".env.local"));
const loadedEnv = loadEnvFile(join(appRoot, ".env"));

const BASE = (process.env.BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(/\/$/, "");
const SLUG = process.env.SLUG ?? "qr-code";
const QUERY = process.env.QUERY ?? "data=paid-e2e";
const pk = process.env.X402_PRIVATE_KEY?.trim();

if (!pk) {
  console.error("Set X402_PRIVATE_KEY (0x…) with Base mainnet USDC. Aborting.");
  console.error("portalv2 options:");
  console.error('  1) $env:X402_PRIVATE_KEY="0x…"; npm run smoke:paid');
  console.error("  2) Write apps/vending-machine/.env.local (gitignored) then npm run smoke:paid");
  console.error(
    `  (env files: .env.local=${loadedLocal ? "found" : "missing"}, .env=${loadedEnv ? "found" : "missing"})`,
  );
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
