from __future__ import annotations

import logging
import os
import sys
import time
from datetime import timedelta
from typing import Any

import pandas as pd

log = logging.getLogger("kronos-api.forecast")

_MODEL = None
_TOKENIZER = None
_PREDICTOR = None
_MODEL_ID: str | None = None
_DEVICE: str | None = None
_LOAD_ERROR: str | None = None


def _ensure_kronos_on_path() -> None:
    """Kronos package lives as `model` when repo is cloned to KRONOS_REPO_PATH."""
    repo = os.environ.get("KRONOS_REPO_PATH", "/opt/kronos").strip()
    if repo and repo not in sys.path and os.path.isdir(repo):
        sys.path.insert(0, repo)


def model_status() -> dict[str, Any]:
    return {
        "loaded": _PREDICTOR is not None,
        "model_id": _MODEL_ID,
        "device": _DEVICE,
        "error": _LOAD_ERROR,
    }


def load_model() -> None:
    """Load Kronos-mini once at process start (warm)."""
    global _MODEL, _TOKENIZER, _PREDICTOR, _MODEL_ID, _DEVICE, _LOAD_ERROR

    if _PREDICTOR is not None:
        return

    model_id = os.environ.get("KRONOS_MODEL_ID", "NeoQuasar/Kronos-mini")
    tokenizer_id = os.environ.get("KRONOS_TOKENIZER_ID", "NeoQuasar/Kronos-Tokenizer-2k")
    device = os.environ.get("KRONOS_DEVICE", "cpu")
    max_context = int(os.environ.get("KRONOS_MAX_CONTEXT", "512"))

    try:
        _ensure_kronos_on_path()
        from model import Kronos, KronosPredictor, KronosTokenizer  # type: ignore

        log.info("loading tokenizer %s", tokenizer_id)
        tokenizer = KronosTokenizer.from_pretrained(tokenizer_id)
        log.info("loading model %s on %s", model_id, device)
        model = Kronos.from_pretrained(model_id)
        # KronosPredictor(model, tokenizer, device=None, max_context=512)
        predictor = KronosPredictor(model, tokenizer, device=device, max_context=max_context)

        _TOKENIZER = tokenizer
        _MODEL = model
        _PREDICTOR = predictor
        _MODEL_ID = model_id
        _DEVICE = device
        _LOAD_ERROR = None
        log.info("kronos ready model_id=%s device=%s", model_id, device)
    except Exception as e:  # noqa: BLE001 — surface load failure on /health
        _LOAD_ERROR = str(e)[:400]
        log.exception("kronos load failed: %s", e)
        raise


def _future_timestamps(last_ts: pd.Timestamp, interval: str, pred_len: int) -> pd.Series:
    step = {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "4h": timedelta(hours=4),
    }.get(interval)
    if step is None:
        raise ValueError(f"interval_not_allowed: {interval}")
    if last_ts.tzinfo is None:
        # treat as UTC
        pass
    out = [last_ts + step * (i + 1) for i in range(pred_len)]
    return pd.Series(out)


def run_forecast(
    df: pd.DataFrame,
    *,
    symbol: str,
    interval: str,
    lookback: int,
    pred_len: int,
    source_ohlcv: str = "unknown",
) -> dict[str, Any]:
    if _PREDICTOR is None:
        raise RuntimeError("model_not_loaded")

    max_lookback = int(os.environ.get("KRONOS_MAX_LOOKBACK", "256"))
    max_pred = int(os.environ.get("KRONOS_MAX_PRED_LEN", "24"))
    lookback = max(16, min(max_lookback, int(lookback), len(df)))
    pred_len = max(1, min(max_pred, int(pred_len)))

    hist = df.tail(lookback).copy()
    x_df = hist[["open", "high", "low", "close", "volume", "amount"]].reset_index(drop=True)
    x_timestamp = hist["timestamps"].reset_index(drop=True)
    last_ts = pd.Timestamp(x_timestamp.iloc[-1])
    y_timestamp = _future_timestamps(last_ts, interval, pred_len)

    t0 = time.perf_counter()
    pred_df = _PREDICTOR.predict(
        df=x_df,
        x_timestamp=x_timestamp,
        y_timestamp=y_timestamp,
        pred_len=pred_len,
        T=1.0,
        top_p=0.9,
        sample_count=1,
    )
    ms = int((time.perf_counter() - t0) * 1000)

    forecast: list[dict[str, Any]] = []
    # pred_df may be indexed by timestamp
    if isinstance(pred_df, pd.DataFrame):
        work = pred_df.reset_index()
        # normalize column names
        cols = {c.lower(): c for c in work.columns}
        for i, row in work.iterrows():
            ts_val = row.get("timestamps") or row.get("index") or y_timestamp.iloc[min(i, len(y_timestamp) - 1)]
            if hasattr(ts_val, "isoformat"):
                t_str = pd.Timestamp(ts_val).isoformat().replace("+00:00", "Z")
            else:
                t_str = str(ts_val)
            forecast.append(
                {
                    "t": t_str,
                    "open": float(row[cols.get("open", "open")]),
                    "high": float(row[cols.get("high", "high")]),
                    "low": float(row[cols.get("low", "low")]),
                    "close": float(row[cols.get("close", "close")]),
                    "volume": float(row[cols.get("volume", "volume")]) if "volume" in cols or "volume" in work.columns else 0.0,
                }
            )

    last_close = float(hist["close"].iloc[-1])
    pred_close_end = float(forecast[-1]["close"]) if forecast else last_close
    pct = ((pred_close_end - last_close) / last_close * 100.0) if last_close else 0.0
    direction = "up" if pct > 0.05 else "down" if pct < -0.05 else "flat"

    return {
        "ok": True,
        "symbol": symbol.upper(),
        "interval": interval,
        "lookback": lookback,
        "pred_len": pred_len,
        "model_id": _MODEL_ID or "unknown",
        "source_ohlcv": source_ohlcv,
        "ms_total": ms,
        "forecast": forecast,
        "summary": {
            "last_close": last_close,
            "pred_close_end": pred_close_end,
            "pct_change": round(pct, 4),
            "direction": direction,
        },
        "disclaimer": (
            "Research forecast only. Not financial advice. "
            "No guarantee of accuracy or profit. Model: Kronos (MIT)."
        ),
    }
