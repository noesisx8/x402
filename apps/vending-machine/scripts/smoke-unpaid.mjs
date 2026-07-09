#!/usr/bin/env node
/**
 * Phase 0 unpaid smoke — no wallet required.
 * Verifies health, discovery, 402 Payment-Required, and Base mainnet accepts.
 *
 * Usage:
 *   node scripts/smoke-unpaid.mjs
 *   BASE_URL=https://vending-machine-seven.vercel.app node scripts/smoke-unpaid.mjs
 */

const BASE = (process.env.BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(/\/$/, "");

let failed = 0;

function ok(label, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`x402 unpaid smoke → ${BASE}\n`);

  // health
  {
    const res = await fetch(`${BASE}/api/health`);
    const j = await res.json();
    ok("health 200", res.status === 200);
    ok("health ok", j.ok === true);
    ok("network_mode base", j.network_mode === "base", j.network_mode);
    ok("pay_to_configured", j.pay_to_configured === true);
    ok("cdp_facilitator_auth", j.cdp_facilitator_auth === true);
  }

  // client config
  {
    const res = await fetch(`${BASE}/api/config/client`);
    const j = await res.json();
    ok("client config base", j.networkMode === "base" && j.caipNetwork === "eip155:8453");
  }

  // discovery
  {
    const res = await fetch(`${BASE}/.well-known/agent-services.json`);
    const j = await res.json();
    ok("agent-services 200", res.status === 200);
    ok("pay_to set", typeof j.pay_to === "string" && j.pay_to.startsWith("0x"));
    ok("services >= 5", Array.isArray(j.services) && j.services.length >= 5, String(j.services?.length));
  }

  // unpaid 402 on qr-code
  {
    const res = await fetch(`${BASE}/api/v/qr-code?data=smoke-test`);
    const pr =
      res.headers.get("payment-required") ?? res.headers.get("Payment-Required");
    ok("qr unpaid status 402", res.status === 402, `status=${res.status}`);
    ok("Payment-Required header", Boolean(pr));

    if (pr) {
      let decoded;
      try {
        decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
      } catch {
        try {
          decoded = JSON.parse(Buffer.from(pr.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        } catch (e) {
          ok("decode Payment-Required", false, String(e));
        }
      }
      if (decoded) {
        const accept = decoded.accepts?.[0];
        ok("x402Version 2", decoded.x402Version === 2, String(decoded.x402Version));
        ok("network eip155:8453", accept?.network === "eip155:8453", accept?.network);
        ok("amount 2000 (0.002 USDC)", accept?.amount === "2000", accept?.amount);
        ok(
          "payTo merchant",
          typeof accept?.payTo === "string" && accept.payTo.toLowerCase().startsWith("0xc648"),
          accept?.payTo,
        );
        ok(
          "resource url bound to path",
          typeof decoded.resource?.url === "string" &&
            decoded.resource.url.includes("/api/v/qr-code"),
          decoded.resource?.url,
        );
      }
    }
  }

  // unknown slug
  {
    const res = await fetch(`${BASE}/api/v/does-not-exist-xyz`);
    ok("unknown slug 404", res.status === 404);
  }

  // Phase 2 hub utilities — unpaid must 402
  for (const path of [
    "/api/v/dns-resolve?host=example.com",
    "/api/v/http-head?url=https://example.com",
    "/api/v/bundle-infra?host=example.com",
  ]) {
    const res = await fetch(`${BASE}${path}`);
    const pr = res.headers.get("payment-required") ?? res.headers.get("Payment-Required");
    ok(`${path} → 402`, res.status === 402, `status=${res.status}`);
    ok(`${path} Payment-Required`, Boolean(pr));
  }

  console.log(failed === 0 ? "\nAll unpaid checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
