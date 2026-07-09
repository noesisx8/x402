/**
 * Lightweight in-memory rate limiter for unpaid 402 spam (Phase 0.5).
 * Per serverless isolate on Vercel — reduces abuse, not a global WAF.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Unpaid probes: N requests per window per IP+slug. */
export const UNPAID_LIMIT = Number(process.env.X402_UNPAID_RATE_LIMIT ?? "30");
export const UNPAID_WINDOW_MS = Number(process.env.X402_UNPAID_RATE_WINDOW_MS ?? String(60_000));

function prune(now: number) {
  if (buckets.size < 2_000) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export function checkRateLimit(
  key: string,
  limit = UNPAID_LIMIT,
  windowMs = UNPAID_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  prune(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const remaining = Math.max(0, limit - b.count);
  const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return {
    allowed: b.count <= limit,
    remaining,
    retryAfterSec,
  };
}

/** Best-effort client IP from Vercel / proxy headers. */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/** Test helper — clear buckets between unit runs. */
export function _resetRateLimitForTests() {
  buckets.clear();
}
