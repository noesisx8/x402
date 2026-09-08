import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { toEventSelector } from "viem";
import { ReceiptSession, receiptRecord, receiptId, recoverReceipt, receiptContext, installReceiptHooks, RESULT_LIMIT, type ReceiptRecord, type ReceiptState, type ReceiptStore } from "../lib/x402/receipts";
import { RedisReceiptStore, CLAIM, TRANSITION } from "../lib/x402/receipt-store";
import { matchesSettlement, reconcileReceipt } from "../lib/x402/receipt-reconcile";

const token = "ab".repeat(32), tx = `0x${"cd".repeat(32)}`, url = "https://vendsdk.com/api/v/dns-resolve?host=example.com";
const accepted = { scheme: "exact", network: "eip155:8453", asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", payTo: `0x${"22".repeat(20)}`, amount: "3000", maxTimeoutSeconds: 120, extra: { name: "USD Coin", version: "2" } };
function payload() { return { x402Version: 2, resource: { url }, accepted, payload: { signature: `0x${"00".repeat(65)}`, authorization: {
  from: `0x${"11".repeat(20)}`, to: accepted.payTo, value: accepted.amount, nonce: `0x${"33".repeat(32)}`,
  validAfter: "0", validBefore: String(Math.floor(Date.now() / 1000) + 120),
} } }; }
const encoded = (p = payload()) => Buffer.from(JSON.stringify(p)).toString("base64");
const record = () => receiptRecord(token, encoded(), url);

class MemoryStore implements ReceiptStore {
  records = new Map<string, ReceiptRecord>(); bodies = new Map<string, string>(); auths = new Set<string>(); failState?: ReceiptState;
  async get(id: string) { return structuredClone(this.records.get(id) ?? null); }
  async result(id: string) { return this.bodies.get(id) ?? null; }
  async claim(rec: ReceiptRecord) {
    if (this.records.has(rec.id) || this.auths.has(rec.authorization)) return false;
    this.records.set(rec.id, structuredClone(rec)); this.auths.add(rec.authorization); return true;
  }
  async transition(id: string, from: ReceiptState[], to: ReceiptState, options: { body?: string; transaction?: string } = {}) {
    if (this.failState === to) throw new Error("storage unavailable");
    const rec = this.records.get(id); if (!rec || !from.includes(rec.state)) return false;
    rec.state = to;
    if (options.body) this.bodies.set(id, options.body);
    if (options.transaction) rec.transaction = options.transaction;
    if (to === "failed") this.bodies.delete(id);
    return true;
  }
}
test("receipt binds exact query, payer and authorization; tokens and signatures are not stored", () => {
  const rec = record(); assert.equal(rec.id, receiptId(token));
  assert.equal(JSON.stringify(rec).includes(token), false); assert.equal("payload" in rec, false);
  assert.throws(() => receiptRecord(token, encoded(), `${url}&other=1`));
  assert.throws(() => receiptId("short"));
  const wrong = payload(); wrong.accepted = { ...accepted, network: "eip155:1" }; assert.throws(() => receiptRecord(token, encoded(wrong), url));
  const long = payload(); long.payload.authorization.validBefore = String(Math.floor(Date.now() / 1000) + 1000); assert.throws(() => receiptRecord(token, encoded(long), url));
});
test("concurrent claims and different tokens cannot reuse a payer nonce", async () => {
  const store = new MemoryStore(), rec = record();
  const results = await Promise.allSettled([new ReceiptSession(store, rec).claim(), new ReceiptSession(store, rec).claim()]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(new ReceiptSession(store, { ...rec, id: receiptId("cd".repeat(32)) }).claim());
});
test("only a settled result is recoverable; expired and unauthorized receipts do not reveal it", async () => {
  const store = new MemoryStore(), session = new ReceiptSession(store, record()); await session.claim();
  await session.prepare('{"ok":true}');
  assert.equal((await recoverReceipt(store, session.record.id)).status, 202);
  await session.beforeSettle(); await session.settled(tx, accepted.network);
  const result = await recoverReceipt(store, session.record.id); assert.equal(result.status, 200); assert.deepEqual(result.body.result, { ok: true });
  assert.equal((await recoverReceipt(store, receiptId("ee".repeat(32)))).status, 404);
  assert.equal((await recoverReceipt(store, session.record.id, session.record.expires)).status, 410);
  store.bodies.clear(); assert.equal((await recoverReceipt(store, session.record.id)).status, 410);
});
test("oversize and failed results never become deliverable or settleable", async () => {
  const store = new MemoryStore(), session = new ReceiptSession(store, record()); await session.claim();
  await assert.rejects(session.prepare("x".repeat(RESULT_LIMIT + 1))); await session.failed();
  await assert.rejects(session.beforeSettle()); assert.equal((await recoverReceipt(store, session.record.id)).status, 409);
});

function proof(rec = record()) {
  const addr = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
  return { status: "success", transactionHash: tx, blockNumber: 100n, logs: [
    { address: rec.asset, topics: [toEventSelector("AuthorizationUsed(address,bytes32)"), addr(rec.payer), rec.nonce], data: "0x" },
    { address: rec.asset, topics: [toEventSelector("Transfer(address,address,uint256)"), addr(rec.payer), addr(rec.payTo)], data: `0x${BigInt(rec.amount).toString(16).padStart(64, "0")}` },
  ] };
}
test("reconciliation requires successful exact USDC authorization and transfer plus 12 confirmations", async () => {
  const rec = record(), evidence = proof(rec);
  assert.equal(matchesSettlement(rec, evidence, tx, 111n), true);
  assert.equal(matchesSettlement(rec, evidence, tx, 110n), false);
  assert.equal(matchesSettlement(rec, { ...evidence, status: "reverted" }, tx, 111n), false);
  for (const key of ["nonce", "payer", "payTo", "asset", "amount"] as const) assert.equal(matchesSettlement({ ...rec, [key]: key === "amount" ? "4000" : `0x${"ff".repeat(key === "nonce" ? 32 : 20)}` }, evidence, tx, 111n), false, key);
  assert.equal(matchesSettlement(rec, { ...evidence, logs: evidence.logs.slice(0, 1) }, tx, 111n), false);
  const store = new MemoryStore(), session = new ReceiptSession(store, rec); await session.claim(); await session.prepare('{"ok":true}'); await session.beforeSettle();
  await reconcileReceipt(store, rec.id, tx, async () => ({ receipt: evidence, head: 111n }));
  assert.equal((await recoverReceipt(store, rec.id)).status, 200);
});
test("Redis requests use atomic scripts, bounded TTLs and fail closed on storage errors", async () => {
  const calls: unknown[][] = [];
  const fake = (async (_url, options) => { calls.push(JSON.parse(String(options?.body))); return Response.json({ result: 1 }); }) as typeof fetch;
  const store = new RedisReceiptStore("https://redis.example", "fixture-not-a-token", "test", fake);
  await store.claim(record()); await store.transition(record().id, ["pending"], "prepared", { body: "{}" });
  assert.equal(calls[0][0], "EVAL"); assert.equal(calls[0][1], CLAIM); assert.equal(calls[0].at(-1), 604800);
  assert.equal(calls[1][1], TRANSITION); assert.equal(calls[1].at(-1), 86400);
  const broken = new RedisReceiptStore("https://redis.example", "fixture", "test", (async () => Response.json({ error: "denied" })) as typeof fetch);
  await assert.rejects(broken.claim(record()), /receipt_storage_unavailable/);
});

async function wrappedFixture(mode: "ok" | "storage-before" | "storage-after" | "settlement-lost" | "invalid-payment") {
  const store = new MemoryStore(), rec = record(), session = new ReceiptSession(store, rec);
  let settlements = 0, executions = 0;
  const server = new x402ResourceServer({
    getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" as const }], extensions: [], signers: {} }),
    verify: async () => ({ isValid: mode !== "invalid-payment", payer: rec.payer, ...(mode === "invalid-payment" ? { invalidReason: "invalid_signature" } : {}) }),
    settle: async () => {
      settlements++; assert.equal((await store.get(rec.id))?.state, "settling"); assert.equal(await store.result(rec.id), '{"ok":true}');
      if (mode === "settlement-lost") throw new Error("simulated dropped facilitator response");
      return { success: true, transaction: tx, network: "eip155:8453" as const, payer: rec.payer };
    },
  }).register("eip155:8453", new ExactEvmScheme());
  installReceiptHooks(server);
  const handler = withX402(async () => {
    await session.claim(); executions++; await session.prepare('{"ok":true}');
    if (mode === "storage-before") store.failState = "settling";
    if (mode === "storage-after") store.failState = "settled";
    return NextResponse.json({ ok: true });
  }, { accepts: { scheme: "exact", network: "eip155:8453", payTo: accepted.payTo, price: "$0.003", maxTimeoutSeconds: 120 } }, server);
  const quote = await handler(new NextRequest(url));
  const required = JSON.parse(Buffer.from(quote.headers.get("payment-required")!, "base64").toString());
  const payment = payload(); payment.accepted = required.accepts[0];
  const response = await receiptContext.run(session, () => handler(new NextRequest(url, { headers: { "PAYMENT-SIGNATURE": encoded(payment) } })));
  return { response, store, rec, settlements, executions };
}
test("actual Next x402 wrapper saves before settlement and recovers after client disconnect", async () => {
  const f = await wrappedFixture("ok"); assert.equal(f.response.status, 200, Buffer.from(f.response.headers.get("payment-required") ?? "", "base64").toString()); assert.equal(f.settlements, 1);
  // Ignore the original response, as if its connection was dropped.
  assert.equal((await recoverReceipt(f.store, f.rec.id)).status, 200);
});
test("actual wrapper does not execute or reserve unverified payments", async () => {
  const f = await wrappedFixture("invalid-payment"); assert.equal(f.response.status, 402); assert.equal(f.executions, 0); assert.equal(f.settlements, 0); assert.equal(await f.store.get(f.rec.id), null);
});
test("storage failure before settlement aborts the actual payment wrapper", async () => {
  const f = await wrappedFixture("storage-before"); assert.ok(f.response.status >= 400); assert.equal(f.settlements, 0); assert.equal(f.executions, 1);
});
test("post-settlement storage failure and lost facilitator response retain pending results", async () => {
  for (const mode of ["storage-after", "settlement-lost"] as const) {
    const f = await wrappedFixture(mode);
    // The SDK deliberately contains afterSettle hook failures: delivery can still succeed.
    assert.equal(f.response.status, mode === "storage-after" ? 200 : 402); assert.equal(f.settlements, 1);
    assert.equal((await recoverReceipt(f.store, f.rec.id)).status, 202);
    f.store.failState = undefined;
    await reconcileReceipt(f.store, f.rec.id, tx, async () => ({ receipt: proof(f.rec), head: 111n }));
    assert.equal((await recoverReceipt(f.store, f.rec.id)).status, 200);
  }
});
