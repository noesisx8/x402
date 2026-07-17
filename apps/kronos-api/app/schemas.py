from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    symbol: str = Field(default="BTCUSDT", examples=["BTCUSDT"])
    interval: Literal["15m", "1h", "4h"] = "1h"
    lookback: int = Field(default=128, ge=16, le=512)
    pred_len: int = Field(default=12, ge=1, le=48)


class Candle(BaseModel):
    t: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class ForecastResponse(BaseModel):
    ok: bool = True
    symbol: str
    interval: str
    lookback: int
    pred_len: int
    model_id: str
    source_ohlcv: str
    ms_total: int
    forecast: list[dict[str, Any]]
    summary: dict[str, Any]
    disclaimer: str


class HealthResponse(BaseModel):
    ok: bool
    model_loaded: bool
    model_id: str | None = None
    device: str | None = None
