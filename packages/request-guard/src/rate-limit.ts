/**
 * Fixed-window counters. One isolate only — see PaymentGate for the paid-lane ledger.
 * apps/vending-machine/scripts/phase0-unit.mjs mirrors `take` below. Keep the arithmetic in sync.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

type Bucket = { count: number; resetAt: number };

export const UNPAID_LIMIT = Number(process.env.X402_UNPAID_RATE_LIMIT ?? "30");
export const UNPAID_WINDOW_MS = Number(process.env.X402_UNPAID_RATE_WINDOW_MS ?? String(60_000));
export const PAID_IP_LIMIT = Number(process.env.X402_PAID_RATE_LIMIT ?? "20");
export const PAID_PAYER_LIMIT = Number(process.env.X402_PAID_PAYER_RATE_LIMIT ?? "30");
export const PAID_WINDOW_MS = Number(process.env.X402_PAID_RATE_WINDOW_MS ?? String(60_000));
export const PAYMENT_MAX_USES = Number(process.env.X402_PAYMENT_MAX_USES ?? "3");
export const PAYER_FAIL_LIMIT = Number(process.env.X402_PAYER_FAIL_LIMIT ?? "8");

export type RateLimiter = {
  take(key: string, limit?: number, windowMs?: number): RateLimitResult;
  reset(): void;
};

export function createRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function prune(now: number) {
    if (buckets.size < 2_000) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    take(key, limit = UNPAID_LIMIT, windowMs = UNPAID_WINDOW_MS) {
      const now = Date.now();
      prune(now);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return {
        allowed: bucket.count <= limit,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSec,
      };
    },
    reset() {
      buckets.clear();
    },
  };
}

const shared = createRateLimiter();

export function checkRateLimit(
  key: string,
  limit = UNPAID_LIMIT,
  windowMs = UNPAID_WINDOW_MS,
): RateLimitResult {
  return shared.take(key, limit, windowMs);
}

export function clientIpFromHeaders(headers: { get(name: string): string | null | undefined }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || headers.get("cf-connecting-ip")?.trim() || "unknown";
}

export function _resetRateLimitForTests() {
  shared.reset();
}
