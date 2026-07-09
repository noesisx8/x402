#!/usr/bin/env node
/**
 * CDP Bazaar readiness checks:
 * 1) Our 402 Payment-Required includes extensions.bazaar
 * 2) Merchant discovery for pay-to (may be empty until first settle post-extension)
 * 3) Semantic search for our domain
 *
 * Usage: node scripts/smoke-bazaar.mjs
 */
const BASE = (process.env.BASE_URL ?? "https://vending-machine-seven.vercel.app").replace(/\/$/, "");
const PAY_TO = (process.env.X402_PAY_TO_ADDRESS ?? "0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697").trim();
const CDP = "https://api.cdp.coinbase.com/platform/v2/x402/discovery";

let failed = 0;
function ok(label, cond, detail = "") {
  if (cond) console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function decodePaymentRequired(header) {
  const raw = header.trim();
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  }
}

async function main() {
  console.log(`Bazaar smoke → ${BASE}\n`);

  // 1) 402 includes bazaar extension
  {
    const res = await fetch(`${BASE}/api/v/dns-resolve?host=example.com`);
    const pr = res.headers.get("payment-required") ?? res.headers.get("Payment-Required");
    ok("dns-resolve 402", res.status === 402);
    ok("Payment-Required present", Boolean(pr));
    if (pr) {
      const body = decodePaymentRequired(pr);
      const bazaar = body.extensions?.bazaar ?? body.accepts?.[0]?.extensions?.bazaar;
      // v2 often puts extensions at top-level of PaymentRequired
      const hasBazaar =
        Boolean(body.extensions?.bazaar) ||
        Boolean(body.accepts?.some?.((a) => a.extensions?.bazaar)) ||
        JSON.stringify(body).includes('"bazaar"');
      ok("402 payload includes bazaar discovery metadata", hasBazaar, hasBazaar ? "found" : "missing — redeploy?");
      if (hasBazaar) {
        console.log("    (bazaar keys present in Payment-Required)");
      } else {
        console.log("    Payment-Required keys:", Object.keys(body).join(", "));
      }
    }
  }

  // 2) Merchant catalog
  {
    const url = `${CDP}/merchant?payTo=${encodeURIComponent(PAY_TO)}&limit=100`;
    const res = await fetch(url);
    ok("merchant discovery HTTP 200", res.status === 200, `status=${res.status}`);
    const j = await res.json();
    const resources = j.resources ?? j.items ?? [];
    const ours = resources.filter((r) => String(r.resource ?? "").includes("vending-machine-seven"));
    console.log(`    merchant resources total=${resources.length} ours=${ours.length}`);
    if (ours.length === 0) {
      console.log(
        "    note: empty is OK until first paid settle AFTER bazaar deploy (~up to 10 min cache)",
      );
    } else {
      ok("at least one of our URLs in merchant catalog", true, String(ours.length));
      for (const r of ours.slice(0, 5)) console.log(`    · ${r.resource}`);
    }
  }

  // 3) Search by domain
  {
    const url = `${CDP}/search?query=${encodeURIComponent("vending-machine-seven.vercel.app")}&network=eip155:8453&limit=20`;
    const res = await fetch(url);
    ok("semantic search HTTP 200", res.status === 200, `status=${res.status}`);
    const j = await res.json();
    const resources = j.resources ?? j.items ?? [];
    const hit = resources.some((r) => String(r.resource ?? "").includes("vending-machine-seven"));
    console.log(`    search hits=${resources.length} our_domain=${hit}`);
    if (!hit) {
      console.log("    note: appears after first CDP settle with bazaar extensions + cache");
    } else {
      ok("search finds our domain", true);
    }
  }

  // 4) Search by payTo filter
  {
    const url = `${CDP}/search?payTo=${encodeURIComponent(PAY_TO)}&network=eip155:8453&limit=20`;
    const res = await fetch(url);
    const j = await res.json();
    const resources = j.resources ?? [];
    console.log(`    search by payTo hits=${resources.length}`);
  }

  console.log(
    failed === 0
      ? "\nBazaar smoke finished (indexing may still be pending first settle)."
      : `\n${failed} hard failure(s).`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
