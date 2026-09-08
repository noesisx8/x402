import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { VendClient, microUsdc, readJson, clientFromEnv } from "../client.mjs";
import { fixture } from "./fixture.mjs";

test("quote verifies the merchant/network and never signs", async () => {
  const f = fixture(); const q = await f.client.quote("dns-resolve", { host: "example.com" });
  assert.equal(q.price_usdc, "0.003000"); assert.equal(q.payment_sent, false);
  assert.equal(f.signatures.length, 0); assert.equal(f.client.budget().reserved_usdc, "0.000000");
});
test("quote/sign/retry keeps the exact URL and reserves the actual price", async () => {
  const f = fixture(); const r = await f.client.paid("dns-resolve", { host: "example.com" }, "0.003");
  assert.equal(f.calls.length, 2); assert.equal(f.calls[0].url, f.calls[1].url);
  assert.equal(f.signatures[0].accepts.length, 1); assert.equal(r.result.ok, true);
  assert.equal(r.budget.remaining_usdc, "0.003000");
});
test("payment defaults off and enabling requires explicit configuration", async () => {
  const c = clientFromEnv({}); assert.equal(c.budget().payments_enabled, false);
  await assert.rejects(c.paid("dns-resolve", {}, "1"), { code: "payments_disabled" });
  assert.throws(() => clientFromEnv({ VENDSDK_ENABLE_PAYMENTS: "true" }), { code: "missing_config" });
});
test("price cap is checked before signing", async () => {
  const f = fixture(); await assert.rejects(f.client.paid("dns-resolve", {}, "0.002"), { code: "budget_exceeded" });
  assert.equal(f.signatures.length, 0);
});
test("concurrent requests cannot overrun the session budget", async () => {
  const f = fixture();
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => f.client.paid("dns-resolve", {}, "0.003")));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 2);
  assert.equal(f.signatures.length, 2); assert.equal(f.client.budget().remaining_usdc, "0.000000");
});
test("ambiguous outcomes reserve budget and block later payments without leaking diagnostics", async () => {
  for (const options of [{ dropPaid: true }, { noReceipt: true }, { paidStatus: 402 }, { paidStatus: 502 }]) {
    const f = fixture(options);
    await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), e => e.code === "payment_outcome_unknown" && !e.message.includes("NEVER DISCLOSE"));
    await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), { code: "review_required" });
    assert.equal(f.signatures.length, 1); assert.equal(f.client.budget().reserved_usdc, "0.003000");
  }
});
test("wrong asset, payee, network, scheme and malformed amounts never sign", async () => {
  for (const option of [{ asset: "0xother" }, { payTo: "0xother" }, { network: "eip155:1" }, { scheme: "upto" }, { amount: "-1" }, { amount: "1.5" }, { amount: "0" }]) {
    const f = fixture({ option });
    await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), { code: "untrusted_quote" });
    assert.equal(f.signatures.length, 0);
  }
});
test("a different resource URL fails before signing", async () => {
  const f = fixture({ mutate: q => { q.resource.url += "&another=resource"; } });
  await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), { code: "invalid_quote" });
  assert.equal(f.signatures.length, 0);
});
test("budget arithmetic uses exact decimal units", () => {
  assert.equal(microUsdc("0.000001"), 1n);
  assert.equal(microUsdc("0.003"), 3000n);
  for (const value of [0.003, "-1", "1e3", "NaN", "0.0000001"]) assert.throws(() => microUsdc(value));
});
test("paths, query arrays, credentials, and oversized responses are rejected", async () => {
  const f = fixture(); assert.throws(() => f.client.url("../admin"));
  assert.throws(() => f.client.url("dns-resolve", { host: [] }));
  assert.throws(() => new VendClient({ origin: "https://user:password@vendsdk.com" }));
  await assert.rejects(readJson(new Response("x".repeat(100)), 10), { code: "response_too_large" });
});
test("real HTTP redirect is refused before signing or forwarding a request", async () => {
  let requests = 0; let signatures = 0;
  const server = createServer((_req, res) => { requests++; res.writeHead(302, { Location: "/redirected" }); res.end(); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new VendClient({ origin: `http://127.0.0.1:${server.address().port}`, allowLocalhost: true,
      maxCall: "0.005", maxSession: "0.005", sign: async () => { signatures++; return "fixture"; } });
    await assert.rejects(client.paid("dns-resolve", {}, "0.003"), { code: "connection_failed" });
    assert.equal(signatures, 0); assert.equal(requests, 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
