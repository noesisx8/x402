/**
 * Re-exports the shared limiter. Paid admission (forged headers, replay, fail budget)
 * lives in @x402-project/request-guard. phase0-unit.mjs still mirrors the bucket arithmetic.
 */

export {
  PAID_IP_LIMIT,
  PAID_PAYER_LIMIT,
  PAID_WINDOW_MS,
  PAYER_FAIL_LIMIT,
  PAYMENT_MAX_USES,
  UNPAID_LIMIT,
  UNPAID_WINDOW_MS,
  _resetRateLimitForTests,
  checkRateLimit,
  clientIpFromHeaders,
} from "@x402-project/request-guard";

export type { RateLimitResult } from "@x402-project/request-guard";
