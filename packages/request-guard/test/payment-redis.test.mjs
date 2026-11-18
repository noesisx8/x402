import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createPaymentGate, readSignedPayment, upstashPaymentLock } from "../dist/index.js";
import { startRedisFixture } from "./redis-fixture.mjs";

let redis;
before(async () => { redis = await startRedisFixture(); });
after(async () => { await redis?.stop(); });
beforeEach(async () => { await redis.command("FLUSHDB"); });
const header = (n = "ab") => JSON.stringify({ payload: {
  signature: `0x${"cd".repeat(65)}`,
  authorization: { from: `0x${"12".repeat(20)}`, nonce: `0x${n.repeat(32)}`,
    validBefore: String(Math.floor(Date.now() / 1000) + 600) },
} });
const fingerprint = () => readSignedPayment(header()).fingerprint;
const lock = (fetchImpl) => upstashPaymentLock(redis.url, "fixture-only", fetchImpl);
const gate = (remote = lock()) => createPaymentGate({ remote, paidIpLimit: 1000, paidPayerLimit: 1000 });
const assertError = (result, status, error) => {
  assert.equal(result.ok, false);
  assert.equal(result.status, status);
  assert.equal(result.error, error);
};

test("two independent gates racing one authorization execute at most one handler", async () => {
  const gates = [gate(), gate()];
  let handlers = 0;
  const decisions = await Promise.all(Array.from({ length: 40 }, (_, i) => gates[i % 2].begin(header(), `ip${i}`)));
  for (const result of decisions) {
    if (result.ok) handlers++;
    else assert.equal(result.error, "payment_already_in_progress");
  }
  assert.equal(handlers, 1);
  await decisions.find((result) => result.ok).finish(200);
  assertError(await gate().begin(header(), "new-instance"), 409, "payment_already_used");
});

test("atomic claim/finalize interleavings never admit after success", async () => {
  const a = lock(), b = lock(), fp = fingerprint();
  assert.equal(await a.claim(fp, "owner-a", 120, 3), "claimed");
  const [, claim] = await Promise.all([a.finish(fp, "owner-a", "used"), b.claim(fp, "owner-b", 120, 3)]);
  assert.ok(["busy", "used"].includes(claim));
  assert.equal(await b.claim(fp, "owner-c", 120, 3), "used");
});

test("definite pre-settlement failures reserve uses atomically across instances", async () => {
  for (let i = 0; i < 3; i++) {
    const result = await gate().begin(header(), "ip");
    assert.equal(result.ok, true);
    await result.finish(400, "retryable");
  }
  assertError(await gate().begin(header(), "ip"), 429, "payment_use_cap");
});

test("stale owners cannot finalize or release a newer claim", async () => {
  const a = lock(), fp = fingerprint();
  assert.equal(await a.claim(fp, "old", 120, 3), "claimed");
  assert.equal(await a.finish(fp, "old", "retryable"), true);
  assert.equal(await a.claim(fp, "new", 120, 3), "claimed");
  for (const outcome of ["retryable", "used", "unknown"]) {
    assert.equal(await a.finish(fp, "old", outcome), false);
    assert.equal(await redis.command("GET", `x402:pay:lock:${fp}`), "new");
  }
  assert.equal(await a.finish(fp, "new", "used"), true);
});

test("process interruption and lease expiry preserve unknown outcome, not a new handler run", async () => {
  const first = await gate().begin(header(), "ip");
  assert.equal(first.ok, true); // Simulate death: do not call finish.
  const fp = fingerprint();
  await redis.command("PEXPIRE", `x402:pay:lock:${fp}`, 1);
  await delay(20);
  assertError(await gate().begin(header(), "different-instance"), 409, "payment_outcome_unknown");
  assert.equal(await lock().finish(fp, "stale", "retryable"), false);
  assert.ok(await redis.command("TTL", `x402:pay:state:${fp}`) > 600);
});

test("ambiguous settlement is never automatically retried, locally or remotely", async () => {
  const a = gate();
  const result = await a.begin(header(), "ip");
  assert.equal(result.ok, true);
  await result.finish(502); // No proof that settlement did not happen.
  for (const instance of [a, gate()]) {
    assertError(await instance.begin(header(), "ip"), 409, "payment_outcome_unknown");
  }
});

test("absent/unavailable store denies admission and production cannot opt out", async () => {
  assertError(await createPaymentGate().begin(header(), "ip"), 503, "payment_lock_unavailable");
  const failing = lock(async () => { throw new Error("fixture_outage"); });
  assertError(await gate(failing).begin(header(), "ip"), 503, "payment_lock_unavailable");
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assertError(await createPaymentGate({ remote: null, requireRemote: false }).begin(header(), "ip"), 503, "payment_lock_unavailable");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test("lost claim/finalize responses fail closed even if Redis committed", async () => {
  let loseReply = true;
  const lossy = lock(async (...args) => {
    const response = await fetch(...args);
    if (loseReply) { await response.json(); throw new Error("fixture_reply_lost"); }
    return response;
  });
  const a = gate(lossy);
  assertError(await a.begin(header(), "ip"), 503, "payment_lock_unavailable");
  assertError(await gate().begin(header(), "ip"), 429, "payment_already_in_progress");
  loseReply = false;
  const admitted = await a.begin(header("ef"), "ip");
  assert.equal(admitted.ok, true);
  loseReply = true;
  await admitted.finish(200);
  assertError(await a.begin(header("ef"), "ip"), 409, "payment_outcome_unknown");
  assertError(await gate().begin(header("ef"), "ip"), 409, "payment_already_used");
});

test("invalid/long-lived authorizations cannot outlive the replay ledger", () => {
  const body = JSON.parse(header());
  for (const validBefore of [undefined, "invalid", "0", String(Math.floor(Date.now() / 1000) + 86401)]) {
    body.payload.authorization.validBefore = validBefore;
    assert.equal(readSignedPayment(JSON.stringify(body)), null);
  }
});

test("store failure during finalization leaves both local and remote admission closed", async () => {
  let offline = false;
  const remote = lock((...args) => {
    if (offline) throw new Error("fixture_store_offline");
    return fetch(...args);
  });
  const a = gate(remote);
  const result = await a.begin(header(), "ip");
  assert.equal(result.ok, true);
  offline = true;
  await result.finish(400, "retryable");
  assertError(await a.begin(header(), "ip"), 409, "payment_outcome_unknown");
  assertError(await gate().begin(header(), "ip"), 429, "payment_already_in_progress");
  await redis.command("PEXPIRE", `x402:pay:lock:${fingerprint()}`, 1);
  await delay(20);
  assertError(await gate().begin(header(), "ip"), 409, "payment_outcome_unknown");
});

test("legacy terminal state and use caps are respected without acquiring a lease", async () => {
  const fp = fingerprint();
  await redis.command("SET", `x402:pay:state:${fp}`, "used", "EX", 120);
  assert.equal(await lock().claim(fp, "new", 120, 3), "used");
  assert.equal(await redis.command("EXISTS", `x402:pay:lock:${fp}`), 0);
  await redis.command("DEL", `x402:pay:state:${fp}`);
  await redis.command("SET", `x402:pay:uses:${fp}`, 3, "EX", 120);
  assert.equal(await lock().claim(fp, "new", 120, 3), "capped");
  assert.equal(await redis.command("EXISTS", `x402:pay:lock:${fp}`), 0);
});
