/**
 * Parse x402 display prices like "$0.003" / "0.003" into USD number.
 * Used for registry validation and global caps (Phase 0.5).
 */

const PRICE_RE = /^\$?(\d+(?:\.\d+)?)$/;

/** Hard ceiling per single call (USDC). Prevents misconfigured routes. */
export const GLOBAL_MAX_PRICE_USD = Number(process.env.X402_MAX_PRICE_USD ?? "0.05");

/** Recommended floor for profitable micropayments after facilitator fees. */
export const RECOMMENDED_MIN_PRICE_USD = 0.002;

export function parsePriceUsd(price: string): number {
  const m = String(price).trim().match(PRICE_RE);
  if (!m) {
    throw new Error(`invalid_price_format: ${price}`);
  }
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`invalid_price_value: ${price}`);
  }
  return n;
}

export function assertPriceWithinCap(price: string, maxUsd = GLOBAL_MAX_PRICE_USD): number {
  const usd = parsePriceUsd(price);
  if (usd > maxUsd) {
    throw new Error(`price_exceeds_cap: ${price} > $${maxUsd}`);
  }
  if (usd <= 0) {
    throw new Error(`price_must_be_positive: ${price}`);
  }
  return usd;
}

/** USDC atomic amount (6 decimals) for exact scheme display/debug. */
export function usdToUsdcAtomic(usd: number): string {
  return String(Math.round(usd * 1e6));
}
