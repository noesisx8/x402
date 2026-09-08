#!/usr/bin/env node
/**
 * Phase 0 unpaid smoke — no wallet required.
 * Verifies health, discovery, 402 Payment-Required, and Base mainnet accepts.
 *
 * Usage:
 *   node scripts/smoke-unpaid.mjs
 *   BASE_URL=https://vending-machine-seven.vercel.app node scripts/smoke-unpaid.mjs
 *   BASE_URLS=https://vendsdk.com,https://vending-machine-seven.vercel.app node scripts/smoke-unpaid.mjs
 */

const DEFAULT_BASE_URLS = ["https://vendsdk.com", "https://vending-machine-seven.vercel.app"];
const bases = (process.env.BASE_URLS ?? process.env.BASE_URL ?? DEFAULT_BASE_URLS.join(","))
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

let failed = 0;

function ok(label, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function decodePaymentRequired(header) {
  const normalized = header.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
}

async function assertPaymentRequired(base, path, expectedAmount) {
  const res = await fetch(`${base}${path}`);
  const paymentRequired = res.headers.get("payment-required");
  ok(`${path} status 402`, res.status === 402, `status=${res.status}`);
  ok(`${path} Payment-Required header`, Boolean(paymentRequired));

  if (!paymentRequired) return;

  let decoded;
  try {
    decoded = decodePaymentRequired(paymentRequired);
    ok(`${path} Payment-Required decodes`, true);
  } catch (error) {
    ok(`${path} Payment-Required decodes`, false, String(error));
    return;
  }

  const accept = decoded.accepts?.[0];
  ok(`${path} x402Version 2`, decoded.x402Version === 2, String(decoded.x402Version));
  ok(`${path} network eip155:8453`, accept?.network === "eip155:8453", accept?.network);
  if (expectedAmount) ok(`${path} amount ${expectedAmount}`, accept?.amount === expectedAmount, accept?.amount);
  ok(
    `${path} payTo EVM address`,
    typeof accept?.payTo === "string" && /^0x[a-fA-F0-9]{40}$/.test(accept.payTo),
    accept?.payTo,
  );
  ok(
    `${path} resource URL uses this public domain`,
    typeof decoded.resource?.url === "string" && decoded.resource.url === `${base}${path}`,
    decoded.resource?.url,
  );
}

async function smokeBase(base) {
  console.log(`x402 unpaid smoke → ${base}\n`);

  // health
  {
    const res = await fetch(`${base}/api/health`);
    const j = await res.json();
    ok("health 200", res.status === 200);
    ok("health ok", j.ok === true);
    ok("network_mode base", j.network_mode === "base", j.network_mode);
    ok("pay_to_configured", j.pay_to_configured === true);
    ok("cdp_facilitator_auth", j.cdp_facilitator_auth === true);
  }

  // client config
  {
    const res = await fetch(`${base}/api/config/client`);
    const j = await res.json();
    ok("client config base", j.networkMode === "base" && j.caipNetwork === "eip155:8453");
  }

  // discovery
  {
    const res = await fetch(`${base}/.well-known/agent-services.json`);
    const j = await res.json();
    ok("agent-services 200", res.status === 200);
    ok("pay_to set", typeof j.pay_to === "string" && j.pay_to.startsWith("0x"));
    ok("services >= 5", Array.isArray(j.services) && j.services.length >= 5, String(j.services?.length));
  }

  await assertPaymentRequired(base, "/api/v/qr-code?data=smoke-test", "2000");
  await assertPaymentRequired(base, "/api/v/tls-cert?host=example.com", "4000");

  // unknown slug
  {
    const res = await fetch(`${base}/api/v/does-not-exist-xyz`);
    ok("unknown slug 404", res.status === 404);
  }

  // Paid catalog — unpaid must 402
  for (const path of [
    "/api/v/dns-resolve?host=example.com",
    "/api/v/http-head?url=https://example.com",
    "/api/v/bundle-infra?host=example.com",
    "/api/v/whois-lite?domain=example.com",
    "/api/v/fx-rate?base=USD&symbols=EUR,GBP",
    "/api/v/redirect-trace?url=https://example.com",
    "/api/v/email-validate?email=test@gmail.com",
    "/api/v/dns-records?host=example.com",
    "/api/v/http-get?url=https://example.com",
    "/api/v/fetch-text?url=https://example.com",
    "/api/v/base-balance?address=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697",
    "/api/v/domain-intel?host=example.com",
  ]) {
    await assertPaymentRequired(base, path);
  }
}

async function main() {
  if (bases.length === 0) throw new Error("Set BASE_URL or BASE_URLS to at least one public endpoint");
  for (const base of bases) await smokeBase(base);
  console.log(failed === 0 ? "\nAll unpaid checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
