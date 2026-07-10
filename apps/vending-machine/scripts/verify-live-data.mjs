#!/usr/bin/env node
/**
 * Production-readiness: run handlers against live upstreams (no x402 payment).
 * Fails if mock markers appear or upstream returns empty/invalid data.
 *
 * Usage (portalv2):
 *   npx --yes tsx scripts/verify-live-data.mjs
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MOCK_RE = /mock_ok|fake_|placeholder|lorem ipsum|TODO_payload|hardcoded_demo/i;

async function loadHandlers() {
  // Compile-free import via tsx if needed
  const tsPath = join(root, "lib/services/handlers.ts");
  try {
    return await import(pathToFileURL(tsPath).href);
  } catch {
    const runner = `
import * as h from ${JSON.stringify(pathToFileURL(tsPath).href)};
const cases = globalThis.__CASES__;
const out = [];
for (const c of cases) {
  try {
    const r = await h[c.fn](new Request("http://local/"), c.query);
    out.push({ id: c.id, ok: true, body: r });
  } catch (e) {
    out.push({ id: c.id, ok: false, error: String(e) });
  }
}
console.log(JSON.stringify(out));
`;
    const tmp = join(tmpdir(), `x402-verify-${Date.now()}.mjs`);
    // Use tsx CLI with inline eval is messy; spawn tsx on a small harness file
    const harness = join(tmpdir(), `x402-harness-${Date.now()}.mts`);
    writeFileSync(
      harness,
      `
import {
  emailValidateHandler, ipLookupHandler, weatherHandler, cryptoPricesHandler,
  qrGeneratorHandler, dnsResolveHandler, httpHeadHandler, tlsCertHandler,
  whoisLiteHandler, fxRateHandler, redirectTraceHandler, bundleInfraHandler,
  dnsRecordsHandler, httpGetHandler, fetchTextHandler, baseBalanceHandler, domainIntelHandler,
} from ${JSON.stringify(pathToFileURL(tsPath).href)};

const cases = [
  { id: "email-validate", fn: emailValidateHandler, query: { email: "test@gmail.com" } },
  { id: "ip-lookup", fn: ipLookupHandler, query: { ip: "8.8.8.8" } },
  { id: "weather", fn: weatherHandler, query: { city: "Berlin" } },
  { id: "crypto-prices", fn: cryptoPricesHandler, query: { ids: "bitcoin" } },
  { id: "qr-code", fn: qrGeneratorHandler, query: { data: "https://x402.org" } },
  { id: "dns-resolve", fn: dnsResolveHandler, query: { host: "example.com" } },
  { id: "http-head", fn: httpHeadHandler, query: { url: "https://example.com" } },
  { id: "tls-cert", fn: tlsCertHandler, query: { host: "example.com" } },
  { id: "whois-lite", fn: whoisLiteHandler, query: { domain: "example.com" } },
  { id: "fx-rate", fn: fxRateHandler, query: { base: "USD", symbols: "EUR,GBP" } },
  { id: "redirect-trace", fn: redirectTraceHandler, query: { url: "https://httpbin.org/redirect/2" } },
  { id: "bundle-infra", fn: bundleInfraHandler, query: { host: "example.com" } },
  { id: "dns-records", fn: dnsRecordsHandler, query: { host: "example.com", types: "A,MX" } },
  { id: "http-get", fn: httpGetHandler, query: { url: "https://httpbin.org/json" } },
  { id: "fetch-text", fn: fetchTextHandler, query: { url: "https://example.com" } },
  { id: "base-balance", fn: baseBalanceHandler, query: { address: "0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697" } },
  { id: "domain-intel", fn: domainIntelHandler, query: { host: "example.com" } },
];

const out = [];
for (const c of cases) {
  try {
    const body = await c.fn(new Request("http://local/test"), c.query);
    out.push({ id: c.id, ok: true, body });
  } catch (e) {
    out.push({ id: c.id, ok: false, error: String(e) });
  }
}
console.log(JSON.stringify(out));
`,
    );
    const r = spawnSync("npx", ["--yes", "tsx", harness], {
      encoding: "utf8",
      cwd: root,
      timeout: 120_000,
      shell: true,
    });
    try {
      unlinkSync(harness);
    } catch {
      /* ignore */
    }
    if (r.status !== 0) {
      console.error(r.stdout);
      console.error(r.stderr);
      throw new Error(`tsx harness failed: ${r.status}`);
    }
    const line = r.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
    return { __results: JSON.parse(line) };
  }
}

function assertNoMock(id, body) {
  const s = JSON.stringify(body);
  if (MOCK_RE.test(s)) throw new Error(`${id}: mock/fake marker in payload: ${s.slice(0, 200)}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("verify-live-data: invoking handlers against real upstreams…\n");
  const mod = await loadHandlers();
  let results;
  if (mod.__results) {
    results = mod.__results;
  } else {
    const cases = [
      { id: "email-validate", fn: mod.emailValidateHandler, query: { email: "test@gmail.com" } },
      { id: "ip-lookup", fn: mod.ipLookupHandler, query: { ip: "8.8.8.8" } },
      { id: "weather", fn: mod.weatherHandler, query: { city: "Berlin" } },
      { id: "crypto-prices", fn: mod.cryptoPricesHandler, query: { ids: "bitcoin" } },
      { id: "qr-code", fn: mod.qrGeneratorHandler, query: { data: "https://x402.org" } },
      { id: "dns-resolve", fn: mod.dnsResolveHandler, query: { host: "example.com" } },
      { id: "http-head", fn: mod.httpHeadHandler, query: { url: "https://example.com" } },
      { id: "tls-cert", fn: mod.tlsCertHandler, query: { host: "example.com" } },
      { id: "whois-lite", fn: mod.whoisLiteHandler, query: { domain: "example.com" } },
      { id: "fx-rate", fn: mod.fxRateHandler, query: { base: "USD", symbols: "EUR,GBP" } },
      { id: "redirect-trace", fn: mod.redirectTraceHandler, query: { url: "https://httpbin.org/redirect/2" } },
      { id: "bundle-infra", fn: mod.bundleInfraHandler, query: { host: "example.com" } },
      { id: "dns-records", fn: mod.dnsRecordsHandler, query: { host: "example.com", types: "A,MX" } },
      { id: "http-get", fn: mod.httpGetHandler, query: { url: "https://httpbin.org/json" } },
      { id: "fetch-text", fn: mod.fetchTextHandler, query: { url: "https://example.com" } },
      { id: "base-balance", fn: mod.baseBalanceHandler, query: { address: "0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697" } },
      { id: "domain-intel", fn: mod.domainIntelHandler, query: { host: "example.com" } },
    ];
    results = [];
    for (const c of cases) {
      try {
        const body = await c.fn(new Request("http://local/test"), c.query);
        results.push({ id: c.id, ok: true, body });
      } catch (e) {
        results.push({ id: c.id, ok: false, error: String(e) });
      }
    }
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) {
      console.error(`  ✗ ${r.id}: ${r.error}`);
      failed++;
      continue;
    }
    try {
      assertNoMock(r.id, r.body);
      const b = r.body;
      switch (r.id) {
        case "email-validate":
          assert(b.valid_format === true, "format");
          assert(Array.isArray(b.mx), "mx array");
          assert(b.has_mx === true, "gmail should have MX");
          assert(b.mx_source === "doh", "mx source");
          assert(b.mx_check === undefined, "no mock_ok field");
          break;
        case "ip-lookup":
          assert(b.country_code || b.country, "geo fields");
          assert(b.source === "ipapi.co", "source");
          break;
        case "weather":
          assert(typeof b.current?.temperature_2m === "number", "temp");
          break;
        case "crypto-prices":
          assert(b.prices?.bitcoin?.usd > 0, "btc price");
          break;
        case "qr-code":
          assert(String(b.png_url).startsWith("https://api.qrserver.com"), "png url");
          assert(String(b.content_type).includes("image"), "image ct");
          break;
        case "dns-resolve":
          assert(b.a?.length > 0, "A records");
          break;
        case "http-head":
          assert(b.status >= 200 && b.status < 600, "status");
          break;
        case "tls-cert":
          assert(b.valid_to || b.fingerprint256, "cert fields");
          break;
        case "whois-lite":
          assert(b.ldh_name || b.domain, "domain");
          assert(b.source === "rdap", "rdap");
          break;
        case "fx-rate":
          assert(typeof b.rates?.EUR === "number" && b.rates.EUR > 0, "EUR rate");
          assert(b.source, "fx source");
          break;
        case "redirect-trace":
          assert(b.hop_count >= 1, "hops");
          assert(Array.isArray(b.hops), "hops array");
          break;
        case "bundle-infra":
          assert(b.dns?.ok || b.http_head?.ok || b.tls?.ok, "bundle piece");
          break;
        case "dns-records":
          assert(b.records?.A || b.records?.MX, "dns records");
          break;
        case "http-get":
          assert(b.status >= 200, "http get status");
          break;
        case "fetch-text":
          assert(typeof b.text === "string" && b.text.length > 0, "page text");
          break;
        case "base-balance":
          assert(b.chain === "base" && typeof b.eth === "string", "base bal");
          break;
        case "domain-intel":
          assert(b.dns?.ok || b.tls?.ok || b.whois?.ok, "intel piece");
          break;
      }
      console.log(`  ✓ ${r.id}`);
    } catch (e) {
      console.error(`  ✗ ${r.id}: ${e.message}`);
      failed++;
    }
  }

  // Source grep for mock markers
  const require = createRequire(import.meta.url);
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  function walk(dir, acc = []) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === "node_modules" || name === ".next") continue;
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (/\.(ts|tsx|js|mjs)$/.test(name)) acc.push(p);
    }
    return acc;
  }
  const files = walk(join(root, "lib")).concat(walk(join(root, "app")));
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (MOCK_RE.test(text) && !f.includes("verify-live-data")) {
      // allow comments about "no mock"
      if (/no mock|never mock|not a mock/i.test(text) && !/mock_ok/.test(text)) continue;
      if (/mock_ok|fake_data|placeholder_payload/.test(text)) {
        console.error(`  ✗ source mock marker: ${f}`);
        failed++;
      }
    }
  }

  console.log(failed === 0 ? "\nAll live-data checks passed." : `\n${failed} failure(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
