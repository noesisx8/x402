/**
 * Operator identity for public legal pages.
 * Set on Vercel Production before treating policies as final.
 */
export type LegalOperator = {
  name: string;
  email: string;
  address: string;
  governingLaw: string;
  venue: string;
  effectiveDate: string;
  lastUpdated: string;
  year: string;
  /** True when any required field is still a placeholder */
  incomplete: boolean;
  missing: string[];
};

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** Values still looking like unfilled template tokens */
function isPlaceholder(v: string): boolean {
  return /\[|PLACEHOLDER|configure|TODO|OPERATOR CONTACT|GOVERNING LAW|VENUE|ADDRESS/i.test(
    v,
  );
}

export function getLegalOperator(): LegalOperator {
  const name =
    env("LEGAL_OPERATOR_NAME") ?? "Operator of the x402 Vending Machine";
  const email = env("LEGAL_CONTACT_EMAIL") ?? "[OPERATOR CONTACT EMAIL]";
  const address = env("LEGAL_OPERATOR_ADDRESS") ?? "[OPERATOR ADDRESS]";
  const governingLaw =
    env("LEGAL_GOVERNING_LAW") ?? "[GOVERNING LAW JURISDICTION]";
  const venue = env("LEGAL_VENUE") ?? "[VENUE]";
  const effectiveDate = env("LEGAL_EFFECTIVE_DATE") ?? "2026-07-17";
  const lastUpdated = env("LEGAL_LAST_UPDATED") ?? effectiveDate;
  const year = String(new Date().getUTCFullYear());

  const missing: string[] = [];
  if (!env("LEGAL_OPERATOR_NAME")) missing.push("LEGAL_OPERATOR_NAME");
  if (!env("LEGAL_CONTACT_EMAIL") || isPlaceholder(email))
    missing.push("LEGAL_CONTACT_EMAIL");
  if (!env("LEGAL_OPERATOR_ADDRESS") || isPlaceholder(address))
    missing.push("LEGAL_OPERATOR_ADDRESS");
  if (!env("LEGAL_GOVERNING_LAW") || isPlaceholder(governingLaw))
    missing.push("LEGAL_GOVERNING_LAW");
  if (!env("LEGAL_VENUE") || isPlaceholder(venue)) missing.push("LEGAL_VENUE");

  return {
    name,
    email,
    address,
    governingLaw,
    venue,
    effectiveDate,
    lastUpdated,
    year,
    incomplete: missing.length > 0,
    missing,
  };
}

/** Confirmed OHLCV cascade used by apps/kronos-api (US-cloud-safe order). */
export const OHLCV_SOURCES =
  "Bybit (primary), Kraken, Binance.US, then Binance.com (last resort; often HTTP 451 from US cloud IPs)";

/** Other market data atoms (not Kronos OHLCV). */
export const MARKET_DATA_SOURCES =
  "CoinGecko (crypto spot), Frankfurter/ECB and open.er-api (FX)";
