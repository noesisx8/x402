import assert from "node:assert/strict";
import { serviceFailure } from "../lib/services/errors.ts";
import { checkRateLimit, _resetRateLimitForTests } from "../lib/rate-limit.ts";
assert.equal(serviceFailure(new Error("missing host")).status, 400);
assert.equal(serviceFailure(new Error("private_ip_not_allowed")).retryable, false);
assert.equal(serviceFailure(new DOMException("Timed out", "TimeoutError")).status, 504);
assert.equal(serviceFailure(new Error("kronos_not_configured: private config")).status, 503);
const upstream = serviceFailure(new Error("upstream 503 secret-body"));
assert.equal(upstream.status, 502);
assert.ok(!JSON.stringify(upstream).includes("secret-body"));
_resetRateLimitForTests();
for (let i = 0; i < 120; i++) assert.equal(checkRateLimit("requests:test", 120, 60000).allowed, true);
assert.equal(checkRateLimit("requests:test", 120, 60000).allowed, false);
console.log("Reliability contracts passed");
process.env.KV_REST_API_URL = "https://analytics.invalid";
process.env.KV_REST_API_TOKEN = "test-only";
const { persistSettlement } = await import("../lib/analytics.ts");
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  });
  const keepAlive = setInterval(() => {}, 1000);
  const started = Date.now();
  try {
    await persistSettlement({ slug: "test", ms: 1, at: new Date().toISOString() });
    assert.ok(Date.now() - started < 1500, "stalled analytics must return within its deadline");
  } finally { clearInterval(keepAlive); }
} finally { globalThis.fetch = originalFetch; }
console.log("Stalled analytics contract passed");
