from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_bearer
from app.forecast import load_model, model_status, run_forecast
from app.ohlcv import fetch_ohlcv
from app.schemas import ForecastRequest, ForecastResponse, HealthResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("kronos-api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Do NOT block process start on HF weight download — Railway healthcheck
    # needs /health immediately. Model loads on first /v1/forecast (or optional warm).
    warm = os.environ.get("KRONOS_WARM_ON_START", "0").strip() in ("1", "true", "yes")
    if warm:
        try:
            load_model()
        except Exception as e:  # noqa: BLE001
            log.error("startup model load failed (health will show model_loaded=false): %s", e)
    else:
        log.info("skipping model warm on start (set KRONOS_WARM_ON_START=1 to enable)")
    yield


app = FastAPI(
    title="x402 Kronos API",
    version="0.1.0",
    description="Private inference backend for vending-machine kronos-forecast (Bearer auth).",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness for Railway. Always 200 if process is up (even if model not loaded)."""
    st = model_status()
    return HealthResponse(
        ok=True,
        model_loaded=bool(st["loaded"]),
        model_id=st.get("model_id"),
        device=st.get("device"),
    )


@app.get("/")
def root() -> dict:
    return {"ok": True, "service": "kronos-api", "health": "/health"}


@app.post("/v1/forecast", response_model=ForecastResponse, dependencies=[Depends(require_bearer)])
async def forecast(body: ForecastRequest) -> ForecastResponse:
    st = model_status()
    if not st["loaded"]:
        # Try lazy load once
        try:
            load_model()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"model_unavailable: {e}") from e

    max_lookback = int(os.environ.get("KRONOS_MAX_LOOKBACK", "256"))
    max_pred = int(os.environ.get("KRONOS_MAX_PRED_LEN", "24"))
    lookback = min(body.lookback, max_lookback)
    pred_len = min(body.pred_len, max_pred)

    try:
        df, source = await fetch_ohlcv(body.symbol, body.interval, lookback)
        result = run_forecast(
            df,
            symbol=body.symbol,
            interval=body.interval,
            lookback=lookback,
            pred_len=pred_len,
            source_ohlcv=source,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        log.exception("forecast failed")
        raise HTTPException(status_code=500, detail=f"forecast_failed: {str(e)[:200]}") from e

    return ForecastResponse(**result)
