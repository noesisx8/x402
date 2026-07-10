#!/usr/bin/env node
/**
 * Fast local unit checks for Phase 0 pricing + rate limit (no network).
 * Run: node scripts/phase0-unit.mjs
 */

import assert from "node:assert/strict";

// Inline mirrors of pure logic so this script runs without TS build.
// Source of truth remains lib/pricing.ts and lib/rate-limit.ts — keep in sync.

const PRICE_RE = /^\$?(\d+(?:\.\d+)?)$/;
const GLOBAL_MAX = 0.05;

function parsePriceUsd(price) {
  const m = String(price).trim().match(PRICE_RE);
  if (!m) throw new Error(`invalid_price_format: ${price}`);
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid_price_value: ${price}`);
  return n;
}

function assertPriceWithinCap(price, maxUsd = GLOBAL_MAX) {
  const usd = parsePriceUsd(price);
  if (usd > maxUsd) throw new Error(`price_exceeds_cap: ${price} > $${maxUsd}`);
  if (usd <= 0) throw new Error(`price_must_be_positive: ${price}`);
  return usd;
}

// --- pricing ---
assert.equal(parsePriceUsd("$0.002"), 0.002);
assert.equal(parsePriceUsd("0.005"), 0.005);
assert.equal(assertPriceWithinCap("$0.01"), 0.01);
assert.throws(() => assertPriceWithinCap("$1.00"), /price_exceeds_cap/);
assert.throws(() => assertPriceWithinCap("$0"), /price_must_be_positive/);
assert.throws(() => parsePriceUsd("free"), /invalid_price_format/);

// Catalog prices must pass cap (mirrors registry — Phase 0 + Phase 2 hub)
for (const p of [
  "$0.004",
  "$0.003",
  "$0.003",
  "$0.005",
  "$0.002",
  "$0.003", // dns-resolve
  "$0.002", // http-head
  "$0.01", // bundle-infra
  "$0.004", // tls-cert
  "$0.008", // whois-lite
  "$0.003", // fx-rate
  "$0.003", // redirect-trace
  "$0.004", // dns-records
  "$0.004", // http-get
  "$0.005", // fetch-text
  "$0.003", // base-balance
  "$0.015", // domain-intel
]) {
  assertPriceWithinCap(p);
}

// --- rate limit (simple token bucket) ---
const buckets = new Map();
function checkRateLimit(key, limit = 3, windowMs = 60_000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

assert.equal(checkRateLimit("a").allowed, true);
assert.equal(checkRateLimit("a").allowed, true);
assert.equal(checkRateLimit("a").allowed, true);
assert.equal(checkRateLimit("a").allowed, false);
assert.equal(checkRateLimit("b").allowed, true);

// --- idempotency contract notes (executable asserts of documented rules) ---
// withX402 settles only when handler status < 400
function wouldSettle(status) {
  return status < 400;
}
assert.equal(wouldSettle(200), true);
assert.equal(wouldSettle(400), false);
assert.equal(wouldSettle(402), false);
assert.equal(wouldSettle(500), false);

console.log("phase0-unit: all passed");
