from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
import pandas as pd

SYMBOL_ALLOW = {"BTCUSDT", "ETHUSDT"}
INTERVAL_ALLOW = {"15m", "1h", "4h"}

BINANCE_KLINES = os.environ.get(
    "KRONOS_OHLCV_URL",
    "https://api.binance.com/api/v3/klines",
)


async def fetch_ohlcv(symbol: str, interval: str, lookback: int) -> pd.DataFrame:
    symbol = symbol.upper().strip()
    if symbol not in SYMBOL_ALLOW:
        raise ValueError(f"symbol_not_allowed: {symbol}")
    if interval not in INTERVAL_ALLOW:
        raise ValueError(f"interval_not_allowed: {interval}")
    lookback = max(16, min(512, int(lookback)))

    params = {"symbol": symbol, "interval": interval, "limit": lookback}
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(BINANCE_KLINES, params=params)
        res.raise_for_status()
        raw = res.json()

    if not isinstance(raw, list) or len(raw) < 16:
        raise ValueError("ohlcv_empty_or_short")

    rows = []
    for k in raw:
        # [ open_time, o, h, l, c, volume, close_time, ... ]
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
    df = pd.DataFrame(rows)
    return df
