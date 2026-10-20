from __future__ import annotations

import os

from fastapi import Header, HTTPException

from app.ingress import tokens_match


def require_bearer(authorization: str | None = Header(default=None)) -> None:
    secret = os.environ.get("KRONOS_API_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="not_configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")
    token = authorization.removeprefix("Bearer ").strip()
    if not tokens_match(token, secret):
        raise HTTPException(status_code=401, detail="invalid_token")
