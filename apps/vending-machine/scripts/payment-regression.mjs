#!/usr/bin/env node
/** Actual route/SDK regression checks, with fake facilitator responses and no network or wallet. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guardDir = resolve(appDir, "../../packages/request-guard/src");
async function withTimeout(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("fixture_timeout")), 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(resolve(appDir, `${specifier.slice(2)}.ts`)).href, context);
    }
    if (specifier === "@x402-project/request-guard") {
      return nextResolve(pathToFileURL(resolve(guardDir, "index.ts")).href, context);
    }
    // Next's bundler resolves this extensionless import; plain Node needs .js.
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.endsWith(".js") && context.parentURL?.startsWith(pathToFileURL(guardDir).href)) {
      const source = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
      if (existsSync(source)) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// Never use local credentials or Redis in these in-process fixtures.
for (const key of ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "KV_REST_API_URL", "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[key];
process.env.X402_NETWORK_MODE = "base-sepolia";
process.env.X402_FACILITATOR_URL = "https://facilitator.invalid";
process.env.X402_PAY_TO_ADDRESS = "0x1111111111111111111111111111111111111111";
process.env.X402_MAX_PRICE_USD = "0.05";
globalThis.fetch = async () => { throw new Error("unexpected_network_request"); };

const { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } = await import("@x402/core/server");
const { ExactEvmScheme } = await import("@x402/evm/exact/server");
const { SingleInitResourceServer } = await import("../lib/x402/single-init-resource-server.ts");
const { paymentPipelineDiagnostics } = await import("../lib/x402/diagnostics.ts");
const { publicErrorMessage } = await import("@x402-project/request-guard");
const supported = { kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }], extensions: [], signers: {} };
const option = { scheme: "exact", network: "eip155:84532", price: "$0.003", payTo: process.env.X402_PAY_TO_ADDRESS };
const routeConfig = { accepts: option };
const createServer = (Server, facilitator) => new Server(facilitator).register("eip155:84532", new ExactEvmScheme());

// Characterize the original SDK race, then ensure our subclass avoids it.
let releaseSupported;
let pauseSupported = false;
let calls = 0;
const facilitator = {
  async getSupported() {
    calls += 1;
    if (pauseSupported) await new Promise((resolve) => { releaseSupported = resolve; });
    return supported;
  },
  async verify() { assert.fail("unexpected verify"); },
  async settle() { assert.fail("unexpected settle"); },
};
const original = createServer(x402ResourceServer, facilitator);
await original.initialize();
pauseSupported = true;
const pendingInitialization = original.initialize();
await assert.rejects(original.buildPaymentRequirements(option), (error) => {
  assert.match(error.message, /Facilitator does not support/);
  assert.equal(publicErrorMessage(error), "request_failed", "race matches the observed sanitized log signature");
  assert.equal(paymentPipelineDiagnostics(error).errorCode, "facilitator_capability_unavailable");
  return true;
});
releaseSupported();
await pendingInitialization;
pauseSupported = false;

const shared = createServer(SingleInitResourceServer, facilitator);
pauseSupported = true;
const firstSharedInitialization = shared.initialize();
assert.equal(shared.initialize(), firstSharedInitialization, "concurrent initialization must share one promise");
releaseSupported();
await firstSharedInitialization;
const afterFirstInit = calls;
pauseSupported = true;
await withTimeout(Promise.all([
  new x402HTTPResourceServer(shared, { "*": routeConfig }).initialize(),
  new x402HTTPResourceServer(shared, { "*": routeConfig }).initialize(),
  shared.buildPaymentRequirements(option),
]));
assert.equal(calls, afterFirstInit, "new route wrappers must not fetch or clear live capabilities");
// Keeping HTTP initialization also preserves per-route fail-closed validation.
await assert.rejects(new x402HTTPResourceServer(shared, {
  "*": { accepts: { ...option, network: "eip155:1" } },
}).initialize(), { name: "RouteConfigurationError" });

let failInitialization = true;
let supportedCalls = 0;
let verifies = 0;
let settles = 0;
HTTPFacilitatorClient.prototype.getSupported = async () => {
  supportedCalls += 1;
  if (failInitialization) {
    failInitialization = false;
    throw new Error("supported_fixture_unavailable");
  }
  return supported;
};
const payer = "0x2222222222222222222222222222222222222222";
HTTPFacilitatorClient.prototype.verify = async () => { verifies += 1; return { isValid: true, payer }; };
HTTPFacilitatorClient.prototype.settle = async () => {
  settles += 1;
  return { success: true, payer, transaction: `0x${"ab".repeat(32)}`, network: "eip155:84532" };
};

const { NextRequest } = await import("next/server.js");
const { GET } = await import("../app/api/v/[slug]/route.ts");
const { SERVICES_BY_SLUG } = await import("../lib/services/registry.ts");
const { getRecentAnalytics } = await import("../lib/analytics.ts");
let handlerCalls = 0;
SERVICES_BY_SLUG.weather.handler = async () => { handlerCalls += 1; throw new Error("missing_required_field"); };
const request = (path = "/api/v/weather", init = {}, slug = "weather") => GET(
  new NextRequest(`https://vending.invalid${path}`, { ...init, headers: { "x-forwarded-for": "192.0.2.10", ...init.headers } }),
  { params: Promise.resolve({ slug }) },
);
const envelope = (nonce, accepted = option) => Buffer.from(JSON.stringify({
  x402Version: 2,
  resource: { url: "https://vending.invalid/api/v/weather" },
  accepted,
  payload: {
    signature: `0x${"11".repeat(65)}`,
    authorization: { from: payer, to: option.payTo, value: "3000", validAfter: "0", validBefore: String(Math.floor(Date.now() / 1000) + 120), nonce: `0x${nonce.repeat(32)}` },
  },
})).toString("base64");

// A failed initial /supported request must return safe JSON and release admission.
const initialHeader = envelope("01");
let response = await request(undefined, { headers: { "payment-signature": initialHeader } });
assert.equal(response.status, 502);
assert.deepEqual(await response.json(), { error: "facilitator_or_server_error", message: "payment pipeline failed" });
let event = getRecentAnalytics().find((entry) => entry.status === 502);
assert.equal(event.stage, "wrapper_initialization");
assert.equal(event.errorCode, "facilitator_initialization_failed");
response = await request();
assert.equal(response.status, 402);
assert.equal(supportedCalls, 2, "failed initialization must retry, then remain cached across wrappers");
const requirements = JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString());
assert.ok(requirements.accepts.length > 0);
assert.equal(requirements.resource.url, "https://vending.invalid/api/v/weather");

// Warm routes, browser negotiation, HEAD, encoded paths and query binding.
for (const [path, init] of [
  ["/api/v/weather", { method: "HEAD" }],
  ["/api/v/%77eather?city=New%20York", {}],
  ["/api/v/weather?city=Boston", {}],
  ["/api/v/weather", { headers: { accept: "text/html", "user-agent": "Mozilla/5.0" } }],
]) {
  response = await request(path, init);
  assert.equal(response.status, 402, `${init.method ?? "GET"} ${path}`);
  const required = JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString());
  assert.equal(required.resource.url, `https://vending.invalid${path}`);
  if (init.headers?.accept) assert.match(response.headers.get("content-type"), /text\/html/);
}
response = await request("/api/v/dns-resolve", {}, "dns-resolve");
assert.equal(response.status, 402);
assert.equal(supportedCalls, 2);
for (const slug of ["__proto__", "constructor", "toString", "unknown-service"]) {
  assert.equal((await request(`/api/v/${slug}`, {}, slug)).status, 404);
}
response = await request(undefined, { headers: { "payment-signature": "malformed" } });
assert.equal(response.status, 400);
assert.equal(handlerCalls, 0);
assert.equal(verifies, 0);
assert.equal(settles, 0);

// The nonce from the initialization failure is available again, and a handler
// error cancels settlement through the actual installed Next wrapper.
const retryHeader = envelope("01", requirements.accepts[0]);
response = await request(undefined, { headers: { "payment-signature": retryHeader } });
assert.equal(response.status, 400);
assert.equal((await response.json()).error, "missing_required_field");
assert.equal(handlerCalls, 1);
assert.equal(verifies, 1);
assert.equal(settles, 0);
response = await request(undefined, { headers: { "payment-signature": retryHeader } });
assert.equal(response.status, 400);
response = await request(undefined, { headers: { "payment-signature": retryHeader } });
assert.equal(response.status, 429);
assert.equal((await response.json()).error, "payment_use_cap");

let releaseHandler;
let notifyHandler;
const handlerStarted = new Promise((resolve) => { notifyHandler = resolve; });
SERVICES_BY_SLUG.weather.handler = async () => {
  handlerCalls += 1;
  notifyHandler();
  await new Promise((resolve) => { releaseHandler = resolve; });
  return { fixture: true };
};
const successfulHeader = envelope("02", requirements.accepts[0]);
const inFlight = request(undefined, { headers: { "payment-signature": successfulHeader } });
await withTimeout(handlerStarted);
response = await request(undefined, { headers: { "payment-signature": successfulHeader } });
assert.equal(response.status, 429);
assert.equal((await response.json()).error, "payment_already_in_progress");
releaseHandler();
response = await inFlight;
assert.equal(response.status, 200);
assert.ok(response.headers.get("payment-response"));
assert.equal(settles, 1);
response = await request(undefined, { headers: { "payment-signature": successfulHeader } });
assert.equal(response.status, 409);
assert.equal((await response.json()).error, "payment_already_used");
assert.equal(settles, 1);

const hostile = new Error("https://upstream.invalid/?api_key=do-not-log PAYMENT-SIGNATURE=do-not-log", {
  cause: Object.assign(new Error("Bearer do-not-log"), { code: "ECONNRESET" }),
});
hostile.name = "do-not-log";
assert.deepEqual(paymentPipelineDiagnostics(hostile), {
  errorClass: "unknown", errorCode: "payment_pipeline_failed", networkErrorCode: "ECONNRESET",
});
assert.equal(JSON.stringify(paymentPipelineDiagnostics(hostile)).includes("do-not-log"), false);
hooks.deregister();
console.log("payment-regression: all passed (fake facilitator, no network, no funded transactions)");
