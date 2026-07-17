from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_bearer
from app.forecast import load_model, model_status, run_forecast
from app.ohlcv import fetch_ohlcv
from app.schemas import ForecastRequest, ForecastResponse, HealthResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("kronos-api")

_warm_lock = threading.Lock()
_warm_started = False


def _warm_model_background() -> None:
    """Load HF weights off the request path so Vercel does not hit 25s timeouts."""
    try:
        log.info("background model warm starting")
        load_model()
        log.info("background model warm complete: %s", model_status())
    except Exception as e:  # noqa: BLE001
        log.exception("background model warm failed: %s", e)


def ensure_warm_started() -> None:
    global _warm_started
    with _warm_lock:
        if _warm_started:
            return
        _warm_started = True
        t = threading.Thread(target=_warm_model_background, name="kronos-warm", daemon=True)
        t.start()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Always kick off background warm so first paid x402 call is not a cold load.
    # Health stays instant (does not wait for weights).
    ensure_warm_started()
    yield


app = FastAPI(
    title="x402 Kronos API",
    version="0.1.1",
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
    return {"ok": True, "service": "kronos-api", "health": "/health", "version": "0.1.1"}


@app.post("/v1/warmup", dependencies=[Depends(require_bearer)])
def warmup() -> dict:
    """Force model load (blocking). Use after deploy; do not call from Vercel x402 path."""
    ensure_warm_started()
    try:
        load_model()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"model_unavailable: {e}") from e
    st = model_status()
    return {"ok": True, "model_loaded": True, "model_id": st.get("model_id"), "device": st.get("device")}


@app.post("/v1/forecast", response_model=ForecastResponse, dependencies=[Depends(require_bearer)])
async def forecast(body: ForecastRequest) -> ForecastResponse:
    st = model_status()
    if not st["loaded"]:
        # Model still warming — load inline (may be slow). Prefer /v1/warmup after deploy.
        try:
            ensure_warm_started()
            load_model()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=503,
                detail=f"model_unavailable: {e}. Retry in ~60s after cold start.",
            ) from e

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
