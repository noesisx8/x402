#!/usr/bin/env node
/** Verifies canonical discovery and per-host x402 challenge binding without payment. */
const CANONICAL = (process.env.CANONICAL_BASE_URL ?? "https://vendsdk.com").replace(/\/$/, "");
const LEGACY = (process.env.LEGACY_BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(/\/$/, "");
const PATH = "/api/v/dns-resolve?host=example.com";
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  else { failed += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}
function decode(header) {
  return JSON.parse(Buffer.from(header.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}
async function checkDiscovery(host) {
  const res = await fetch(`${host}/.well-known/agent-services.json`);
  const body = await res.json();
  ok(`${host} discovery 200`, res.status === 200, `status=${res.status}`);
  ok(`${host} discovery uses canonical URLs`, Array.isArray(body.services) && body.services.every((s) => s.url?.startsWith(`${CANONICAL}/`)));
}
async function checkChallenge(host) {
  const res = await fetch(`${host}${PATH}`);
  const header = res.headers.get("payment-required");
  ok(`${host} unpaid request is 402`, res.status === 402, `status=${res.status}`);
  ok(`${host} Payment-Required is present`, Boolean(header));
  if (!header) return;
  const body = decode(header);
  const accept = body.accepts?.[0];
  ok(`${host} resource URL preserves request host`, body.resource?.url === `${host}${PATH}`, body.resource?.url);
  ok(`${host} Base mainnet network`, accept?.network === "eip155:8453", accept?.network);
  ok(`${host} payTo present`, typeof accept?.payTo === "string" && accept.payTo.startsWith("0x"));
  ok(`${host} dns-resolve price preserved`, accept?.amount === "3000", accept?.amount);
}
async function main() {
  console.log(`VendSDK migration smoke\ncanonical: ${CANONICAL}\nlegacy: ${LEGACY}\n`);
  for (const host of [CANONICAL, LEGACY]) { await checkDiscovery(host); await checkChallenge(host); }
  console.log(failed === 0 ? "\nAll migration checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((error) => { console.error(error); process.exit(1); });
