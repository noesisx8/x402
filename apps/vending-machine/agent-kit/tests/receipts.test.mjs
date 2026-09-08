import test from "node:test";
import assert from "node:assert/strict";
import { VendClient } from "../client.mjs";
import { fixture } from "./fixture.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.mjs";

function receiptFixture(available = true) {
  const f = fixture(); let signs = 0; let savedToken; const calls = [];
  const client = new VendClient({ enableReceipts: true, maxCall: "0.005", maxSession: "0.006",
    sign: async () => { signs++; return "fixture-signature"; },
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/api/receipts")) {
        if (options.method !== "POST") return Response.json({ available });
        assert.equal(options.headers.Authorization, `Bearer ${savedToken}`);
        assert.equal(options.headers["PAYMENT-SIGNATURE"], undefined);
        return Response.json({ state: "settled", network: "eip155:8453", transaction: `0x${"ab".repeat(32)}`, result: { ok: true } });
      }
      if (options.headers?.["PAYMENT-SIGNATURE"]) {
        savedToken = options.headers["X-VendSDK-Receipt"];
        assert.match(savedToken, /^[a-f0-9]{64}$/); throw new Error("simulated connection loss");
      }
      return f.client.fetchFn(url, options);
    },
  });
  return { client, calls, signs: () => signs, token: () => savedToken };
}
test("receipt recovery after uncertain payment never signs again, leaks the token, or clears budget", async () => {
  const f = receiptFixture(); let error;
  try { await f.client.paid("dns-resolve", {}, "0.003"); } catch (e) { error = e; }
  assert.equal(error.code, "payment_outcome_unknown"); assert.match(error.receipt_handle, /^[a-f0-9-]{36}$/);
  assert.equal(JSON.stringify(error).includes(f.token()), false);
  const result = await f.client.recoverHandle(error.receipt_handle);
  assert.equal(result.result.ok, true); assert.equal(result.payment_sent, false); assert.equal(f.signs(), 1);
  assert.equal(f.client.budget().review_required, true); assert.equal(f.client.budget().reserved_usdc, "0.003000");
  assert.equal(f.calls.at(-1).options.redirect, "error");
  await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), { code: "review_required" });
});
test("receipt mode fails before payment when durable storage is not available", async () => {
  const f = receiptFixture(false);
  await assert.rejects(f.client.paid("dns-resolve", {}, "0.003"), { code: "receipts_unavailable" });
  assert.equal(f.signs(), 0); assert.equal(f.client.budget().reserved_usdc, "0.000000");
});
test("caller can supply a saved token for recovery across process restarts", async () => {
  const f = receiptFixture(), token = "ff".repeat(32);
  await assert.rejects(f.client.paid("dns-resolve", {}, "0.003", token));
  assert.equal(f.token(), token);
  assert.equal((await f.client.recover(token)).state, "settled");
  await assert.rejects(f.client.recoverHandle("unknown"), { code: "unknown_receipt_handle" });
});
test("MCP exposes recovery handles without bearer tokens and allows recovery while payments are stopped", async () => {
  const f = receiptFixture(), server = createServer(f.client), client = new Client({ name: "receipt-tests", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const paid = await client.callTool({ name: "call_service", arguments: { slug: "dns-resolve", query: {}, max_price_usdc: "0.003" } });
    assert.equal(paid.isError, true); assert.equal(JSON.stringify(paid).includes(f.token()), false);
    const result = await client.callTool({ name: "recover_receipt", arguments: { receipt_handle: paid.structuredContent.receipt_handle } });
    assert.equal(result.structuredContent.state, "settled"); assert.equal(f.signs(), 1);
  } finally { await client.close(); await server.close(); }
});
