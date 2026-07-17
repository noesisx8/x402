from __future__ import annotations

import os

from fastapi import Header, HTTPException


def require_bearer(authorization: str | None = Header(default=None)) -> None:
    secret = os.environ.get("KRONOS_API_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="KRONOS_API_SECRET not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")
    token = authorization.removeprefix("Bearer ").strip()
    if token != secret:
        raise HTTPException(status_code=401, detail="invalid_token")
