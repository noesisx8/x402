/**
 * Server-side client for apps/kronos-api (Railway / portalv2).
 * Never expose KRONOS_API_SECRET to browsers.
 */
import { serverEnv } from "@/lib/env";

const SYMBOL_ALLOW = new Set(["BTCUSDT", "ETHUSDT"]);
const INTERVAL_ALLOW = new Set(["15m", "1h", "4h"]);
const MAX_LOOKBACK = 256;
const MAX_PRED_LEN = 24;
/**
 * Must stay under route maxDuration (60s on Pro). Cold Kronos loads can exceed 25s —
 * keep model warm on Railway (background warm + /v1/warmup) so paid calls finish sooner.
 */
const CLIENT_TIMEOUT_MS = Number(process.env.KRONOS_CLIENT_TIMEOUT_MS ?? "55000");

export type KronosForecastInput = {
  symbol: string;
  interval: string;
  lookback: number;
  pred_len: number;
  model: string;
};

export async function callKronosForecast(
  input: KronosForecastInput,
): Promise<Record<string, unknown>> {
  const base = serverEnv.KRONOS_API_URL?.replace(/\/$/, "");
  const secret = serverEnv.KRONOS_API_SECRET?.trim();
  if (!base || !secret) {
    throw new Error("kronos_not_configured: set KRONOS_API_URL and KRONOS_API_SECRET");
  }

  const symbol = input.symbol.toUpperCase();
  if (!SYMBOL_ALLOW.has(symbol)) {
    throw new Error(`symbol_not_allowed: ${symbol} (allow: BTCUSDT,ETHUSDT)`);
  }
  if (!INTERVAL_ALLOW.has(input.interval)) {
    throw new Error(`interval_not_allowed: ${input.interval} (allow: 15m,1h,4h)`);
  }
  if (input.model !== "mini") {
    throw new Error("model_not_allowed: only mini in v1");
  }
  const lookback = Math.min(MAX_LOOKBACK, Math.max(16, Math.floor(input.lookback)));
  const pred_len = Math.min(MAX_PRED_LEN, Math.max(1, Math.floor(input.pred_len)));

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/v1/forecast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        symbol,
        interval: input.interval,
        lookback,
        pred_len,
      }),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`kronos_upstream_unreachable: ${String(e).slice(0, 160)}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kronos_upstream_${res.status}: ${text.slice(0, 160)}`);
  }

  const body = (await res.json()) as Record<string, unknown>;
  const forecast = body.forecast;
  if (!Array.isArray(forecast) || forecast.length === 0) {
    throw new Error("kronos_empty_forecast");
  }

  return {
    symbol,
    interval: input.interval,
    lookback,
    pred_len,
    model_id: body.model_id ?? "NeoQuasar/Kronos-mini",
    source_ohlcv: body.source_ohlcv ?? "binance",
    ms_total: Date.now() - started,
    ms_upstream: body.ms_total ?? null,
    forecast,
    summary: body.summary ?? null,
    disclaimer:
      body.disclaimer ??
      "Research forecast only. Not financial advice. No guarantee of accuracy or profit.",
  };
}
