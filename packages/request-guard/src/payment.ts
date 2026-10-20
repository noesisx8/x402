/**
 * App-side payment admission. Facilitator verify is not a lock:
 * the same EIP-3009 nonce can pass verify on many requests and settle once.
 * This gate rejects malformed envelopes before any facilitator call, single-flights
 * a fingerprint, and caps how many handler runs one authorization can buy.
 */

import {
  PAID_IP_LIMIT,
  PAID_PAYER_LIMIT,
  PAID_WINDOW_MS,
  PAYER_FAIL_LIMIT,
  PAYMENT_MAX_USES,
  UNPAID_LIMIT,
  UNPAID_WINDOW_MS,
  createRateLimiter,
  type RateLimitResult,
} from "./rate-limit.js";
import { type RemotePaymentLock } from "./remote-lock.js";

const MIN_TTL_MS = 120_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HEADER_CHARS = 16_384;

export type SignedPayment = {
  payer: string;
  nonce: string;
  fingerprint: string;
  expiresAtMs: number;
};

export type PaymentRejection = {
  ok: false;
  status: 400 | 409 | 429;
  error: string;
  retryAfterSec?: number;
};

export type PaymentAdmission = {
  ok: true;
  payer: string;
  fingerprint: string;
  finish(status: number): Promise<void>;
};

export type BeginResult = PaymentAdmission | PaymentRejection;

export type PaymentGateOptions = {
  now?: () => number;
  unpaidLimit?: number;
  unpaidWindowMs?: number;
  paidIpLimit?: number;
  paidPayerLimit?: number;
  paidWindowMs?: number;
  maxUses?: number;
  payerFailLimit?: number;
  /** Pass null to force the in-memory ledger only. */
  remote?: RemotePaymentLock | null;
};

type LedgerRecord = {
  inFlight: boolean;
  uses: number;
  consumed: boolean;
  expiresAt: number;
};

type FailStreak = { count: number; resetAt: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodePaymentHeader(header: string): unknown {
  const trimmed = header.trim();
  if (!trimmed || trimmed.length > MAX_HEADER_CHARS) return null;
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  try {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const text = Buffer.from(padded, "base64").toString("utf8");
    if (!text.trimStart().startsWith("{")) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Structural check only. A null return means the envelope must not reach the facilitator. */
export function readSignedPayment(header: string, now = Date.now()): SignedPayment | null {
  const root = asRecord(decodePaymentHeader(header));
  if (!root) return null;
  const payload = asRecord(root.payload) ?? root;
  const signature = payload.signature;
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{64,2048}$/.test(signature)) return null;

  const authorization = asRecord(payload.authorization);
  const permit2 = asRecord(payload.permit2Authorization);
  const auth = authorization ?? permit2;
  if (!auth) return null;

  const from = auth.from;
  if (typeof from !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(from)) return null;

  const nonceRaw = auth.nonce;
  const nonce = typeof nonceRaw === "number" && Number.isSafeInteger(nonceRaw) ? String(nonceRaw) : nonceRaw;
  if (typeof nonce !== "string") return null;
  const nonceOk = authorization
    ? /^0x[0-9a-fA-F]{64}$/.test(nonce)
    : /^(0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/.test(nonce);
  if (!nonceOk) return null;

  const expiryRaw = authorization ? auth.validBefore : auth.deadline;
  let expiresAtMs = now + MIN_TTL_MS;
  if (typeof expiryRaw === "string" && /^[0-9]{1,20}$/.test(expiryRaw)) {
    const seconds = Number(expiryRaw);
    if (Number.isFinite(seconds)) expiresAtMs = Math.max(expiresAtMs, seconds * 1000);
  } else if (typeof expiryRaw === "number" && Number.isFinite(expiryRaw)) {
    expiresAtMs = Math.max(expiresAtMs, expiryRaw * 1000);
  }
  expiresAtMs = Math.min(expiresAtMs, now + MAX_TTL_MS);

  const payer = from.toLowerCase();
  const normalizedNonce = nonce.toLowerCase();
  return {
    payer,
    nonce: normalizedNonce,
    fingerprint: `${payer}:${normalizedNonce}`,
    expiresAtMs,
  };
}

export type PaymentGate = {
  takeUnpaid(ip: string, bucket: string): RateLimitResult;
  begin(header: string, ip: string): Promise<BeginResult>;
  reset(): void;
};

export function createPaymentGate(options: PaymentGateOptions = {}): PaymentGate {
  const now = options.now ?? Date.now;
  const unpaidLimit = options.unpaidLimit ?? UNPAID_LIMIT;
  const unpaidWindowMs = options.unpaidWindowMs ?? UNPAID_WINDOW_MS;
  const paidIpLimit = options.paidIpLimit ?? PAID_IP_LIMIT;
  const paidPayerLimit = options.paidPayerLimit ?? PAID_PAYER_LIMIT;
  const paidWindowMs = options.paidWindowMs ?? PAID_WINDOW_MS;
  const maxUses = options.maxUses ?? PAYMENT_MAX_USES;
  const payerFailLimit = options.payerFailLimit ?? PAYER_FAIL_LIMIT;
  const remote = options.remote ?? null;
  const limits = createRateLimiter();
  const ledger = new Map<string, LedgerRecord>();
  const streaks = new Map<string, FailStreak>();

  function prune(at: number) {
    if (ledger.size < 2_000) return;
    for (const [key, record] of ledger) {
      if (record.expiresAt <= at && !record.inFlight) ledger.delete(key);
    }
  }

  function payerBlocked(payer: string, at: number): number | null {
    const streak = streaks.get(payer);
    if (!streak) return null;
    if (streak.resetAt <= at) {
      streaks.delete(payer);
      return null;
    }
    if (streak.count < payerFailLimit) return null;
    return Math.max(1, Math.ceil((streak.resetAt - at) / 1000));
  }

  function notePayer(payer: string, status: number, at: number) {
    if (status < 400) {
      streaks.delete(payer);
      return;
    }
    const existing = streaks.get(payer);
    if (!existing || existing.resetAt <= at) {
      streaks.set(payer, { count: 1, resetAt: at + paidWindowMs });
      return;
    }
    existing.count += 1;
  }

  return {
    takeUnpaid(ip, bucket) {
      return limits.take(`unpaid:${ip}:${bucket}`, unpaidLimit, unpaidWindowMs);
    },

    async begin(header, ip) {
      const at = now();
      const ipLimit = limits.take(`paid-ip:${ip}`, paidIpLimit, paidWindowMs);
      if (!ipLimit.allowed) {
        return { ok: false, status: 429, error: "rate_limited", retryAfterSec: ipLimit.retryAfterSec };
      }

      const payment = readSignedPayment(header, at);
      if (!payment) return { ok: false, status: 400, error: "payment_malformed" };

      const payerLimit = limits.take(`paid-payer:${payment.payer}`, paidPayerLimit, paidWindowMs);
      if (!payerLimit.allowed) {
        return { ok: false, status: 429, error: "rate_limited", retryAfterSec: payerLimit.retryAfterSec };
      }

      const blockedFor = payerBlocked(payment.payer, at);
      if (blockedFor !== null) {
        return { ok: false, status: 429, error: "payer_fail_budget", retryAfterSec: blockedFor };
      }

      prune(at);
      let record = ledger.get(payment.fingerprint);
      if (!record || (record.expiresAt <= at && !record.inFlight)) {
        record = { inFlight: false, uses: 0, consumed: false, expiresAt: payment.expiresAtMs };
        ledger.set(payment.fingerprint, record);
      }
      record.expiresAt = Math.max(record.expiresAt, payment.expiresAtMs);
      if (record.consumed) return { ok: false, status: 409, error: "payment_already_used" };
      if (record.inFlight) {
        return { ok: false, status: 429, error: "payment_already_in_progress", retryAfterSec: 1 };
      }
      if (record.uses >= maxUses) return { ok: false, status: 429, error: "payment_use_cap", retryAfterSec: 1 };

      // Synchronous with respect to the event loop: concurrent requests cannot pass this together.
      record.inFlight = true;
      record.uses += 1;
      const held = record;
      let settled = false;

      const cancel = () => {
        if (settled) return;
        settled = true;
        held.inFlight = false;
        held.uses = Math.max(0, held.uses - 1);
      };

      if (remote) {
        const ttlSec = Math.max(120, Math.ceil((held.expiresAt - at) / 1000));
        try {
          const claim = await remote.claim(payment.fingerprint, ttlSec, maxUses);
          if (claim !== "claimed") {
            cancel();
            if (claim === "used") return { ok: false, status: 409, error: "payment_already_used" };
            if (claim === "capped") return { ok: false, status: 429, error: "payment_use_cap", retryAfterSec: 1 };
            return { ok: false, status: 429, error: "payment_already_in_progress", retryAfterSec: 1 };
          }
        } catch {
          // Same-isolate lock still holds. Cross-isolate replay is open until Redis answers again.
          console.error(JSON.stringify({ scope: "x402", event: "payment_lock_unavailable" }));
        }
      }

      return {
        ok: true,
        payer: payment.payer,
        fingerprint: payment.fingerprint,
        async finish(status: number) {
          if (settled) return;
          settled = true;
          held.inFlight = false;
          if (status < 400) held.consumed = true;
          notePayer(payment.payer, status, now());
          if (!remote) return;
          const ttlSec = Math.max(120, Math.ceil((held.expiresAt - now()) / 1000));
          try {
            await remote.finish(payment.fingerprint, status, ttlSec, maxUses);
          } catch {
            console.error(JSON.stringify({ scope: "x402", event: "payment_lock_unavailable" }));
          }
        },
      };
    },

    reset() {
      limits.reset();
      ledger.clear();
      streaks.clear();
    },
  };
}
