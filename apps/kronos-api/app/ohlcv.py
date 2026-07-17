from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx
import pandas as pd

log = logging.getLogger("kronos-api.ohlcv")

SYMBOL_ALLOW = {"BTCUSDT", "ETHUSDT"}
INTERVAL_ALLOW = {"15m", "1h", "4h"}

# Binance.com often returns HTTP 451 from US cloud regions (Railway sfo).
# Prefer Bybit / Kraken / Binance.US which remain reachable from the US.
BYBIT_KLINES = "https://api.bybit.com/v5/market/kline"
KRAKEN_OHLC = "https://api.kraken.com/0/public/OHLC"
BINANCE_US_KLINES = "https://api.binance.us/api/v3/klines"
BINANCE_COM_KLINES = "https://api.binance.com/api/v3/klines"

INTERVAL_MINUTES = {"15m": 15, "1h": 60, "4h": 240}

KRAKEN_PAIR = {
    "BTCUSDT": "XBTUSD",
    "ETHUSDT": "ETHUSD",
}


def _rows_to_df(rows: list[dict]) -> pd.DataFrame:
    if len(rows) < 16:
        raise ValueError("ohlcv_empty_or_short")
    df = pd.DataFrame(rows)
    df = df.sort_values("timestamps").reset_index(drop=True)
    return df


async def _fetch_bybit(
    client: httpx.AsyncClient, symbol: str, interval: str, lookback: int
) -> pd.DataFrame:
    # Bybit interval: 15, 60, 240 (minutes)
    bybit_interval = str(INTERVAL_MINUTES[interval])
    res = await client.get(
        BYBIT_KLINES,
        params={
            "category": "spot",
            "symbol": symbol,
            "interval": bybit_interval,
            "limit": lookback,
        },
    )
    res.raise_for_status()
    body = res.json()
    try:
        ret = int(body.get("retCode", -1))
    except (TypeError, ValueError):
        ret = -1
    if ret != 0:
        raise ValueError(f"bybit_retCode_{body.get('retCode')}:{body.get('retMsg')}")
    lst = (body.get("result") or {}).get("list") or []
    if not lst:
        raise ValueError("bybit_empty")
    # Bybit returns newest-first: [start, open, high, low, close, volume, turnover]
    rows = []
    for k in reversed(lst):
        open_time_ms = int(k[0])
        o, h, l, c, vol = float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])
        turnover = float(k[6]) if len(k) > 6 else vol * c
        rows.append(
            {
                "timestamps": datetime.fromtimestamp(open_time_ms / 1000, tz=timezone.utc),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": vol,
                "amount": turnover,
            }
        )
    return _rows_to_df(rows)


async def _fetch_kraken(
    client: httpx.AsyncClient, symbol: str, interval: str, lookback: int
) -> pd.DataFrame:
    pair = KRAKEN_PAIR.get(symbol)
    if not pair:
        raise ValueError(f"kraken_pair_missing:{symbol}")
    res = await client.get(
        KRAKEN_OHLC,
        params={"pair": pair, "interval": INTERVAL_MINUTES[interval]},
    )
    res.raise_for_status()
    body = res.json()
    if body.get("error"):
        raise ValueError(f"kraken_error:{body['error']}")
    result = body.get("result") or {}
    # Key is actual pair name, not always the request pair
    series = None
    for k, v in result.items():
        if k == "last":
            continue
        if isinstance(v, list):
            series = v
            break
    if not series:
        raise ValueError("kraken_empty")
    # Take last `lookback` candles
    series = series[-lookback:]
    rows = []
    for k in series:
        # time, open, high, low, close, vwap, volume, count
        ts = int(k[0])
        o, h, l, c, vol = float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[6])
        rows.append(
            {
                "timestamps": datetime.fromtimestamp(ts, tz=timezone.utc),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": vol,
                "amount": vol * c,
            }
        )
    return _rows_to_df(rows)


async def _fetch_binance_style(
    client: httpx.AsyncClient, base_url: str, symbol: str, interval: str, lookback: int
) -> pd.DataFrame:
    res = await client.get(
        base_url,
        params={"symbol": symbol, "interval": interval, "limit": lookback},
    )
    res.raise_for_status()
    raw = res.json()
    if not isinstance(raw, list) or len(raw) < 16:
        raise ValueError("binance_empty_or_short")
    rows = []
    for k in raw:
        open_time_ms = int(k[0])
        rows.append(
            {
                "timestamps": datetime.fromtimestamp(open_time_ms / 1000, tz=timezone.utc),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
                "amount": float(k[7]) if len(k) > 7 else float(k[5]) * float(k[4]),
            }
        )
    return _rows_to_df(rows)


async def fetch_ohlcv(symbol: str, interval: str, lookback: int) -> tuple[pd.DataFrame, str]:
    """
    Fetch OHLCV with multi-source fallback.

    Returns (dataframe, source_name).
    Binance.com is last — frequently 451 from US cloud IPs.
    """
    symbol = symbol.upper().strip()
    if symbol not in SYMBOL_ALLOW:
        raise ValueError(f"symbol_not_allowed: {symbol}")
    if interval not in INTERVAL_ALLOW:
        raise ValueError(f"interval_not_allowed: {interval}")
    lookback = max(16, min(512, int(lookback)))

    # Optional override: single URL (binance-style klines only)
    forced = os.environ.get("KRONOS_OHLCV_URL", "").strip()

    errors: list[str] = []
    async with httpx.AsyncClient(
        timeout=20.0,
        headers={"User-Agent": "x402-kronos-api/0.1"},
    ) as client:
        if forced:
            try:
                df = await _fetch_binance_style(client, forced, symbol, interval, lookback)
                return df, forced
            except Exception as e:  # noqa: BLE001
                raise ValueError(f"ohlcv_forced_url_failed: {e}") from e

        attempts: list[tuple[str, object]] = [
            ("bybit", lambda: _fetch_bybit(client, symbol, interval, lookback)),
            ("kraken", lambda: _fetch_kraken(client, symbol, interval, lookback)),
            (
                "binance.us",
                lambda: _fetch_binance_style(client, BINANCE_US_KLINES, symbol, interval, lookback),
            ),
            (
                "binance.com",
                lambda: _fetch_binance_style(client, BINANCE_COM_KLINES, symbol, interval, lookback),
            ),
        ]

        for name, fn in attempts:
            try:
                df = await fn()  # type: ignore[misc]
                log.info("ohlcv ok source=%s symbol=%s rows=%s", name, symbol, len(df))
                return df, name
            except Exception as e:  # noqa: BLE001
                msg = f"{name}:{type(e).__name__}:{str(e)[:120]}"
                errors.append(msg)
                log.warning("ohlcv fail %s", msg)

    raise ValueError("ohlcv_all_sources_failed: " + " | ".join(errors))
