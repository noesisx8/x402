"""Ingress limits for kronos-api.

Body size is enforced before the ASGI app reads JSON, and protected POSTs
require a bearer token before that app runs. This is a raw ASGI wrapper:
Starlette's BaseHTTPMiddleware parses the body on the way through.
"""

from __future__ import annotations

import hmac
import os
from collections.abc import Awaitable, Callable

DEFAULT_MAX_BODY = 64 * 1024
PROTECTED_PATHS = {"/v1/forecast", "/v1/warmup"}

Scope = dict
Message = dict
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


def max_body_bytes() -> int:
    raw = os.environ.get("KRONOS_MAX_BODY_BYTES", "").strip()
    if not raw:
        return DEFAULT_MAX_BODY
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_MAX_BODY
    return value if value > 0 else DEFAULT_MAX_BODY


def tokens_match(token: str, secret: str) -> bool:
    """Constant-time compare. hmac.compare_digest raises when lengths differ."""
    token_b = token.encode("utf-8")
    secret_b = secret.encode("utf-8")
    if len(token_b) != len(secret_b):
        return False
    return hmac.compare_digest(token_b, secret_b)


def _header(scope: Scope, name: bytes) -> bytes | None:
    for key, value in scope.get("headers") or []:
        if bytes(key).lower() == name:
            return bytes(value)
    return None


def _content_length(scope: Scope) -> int | None:
    found: int | None = None
    for key, value in scope.get("headers") or []:
        if bytes(key).lower() != b"content-length":
            continue
        try:
            parsed = int(bytes(value).strip() or b"")
        except ValueError:
            return 10**18
        if parsed < 0:
            return 10**18
        found = parsed if found is None else max(found, parsed)
    return found


def _path(scope: Scope) -> str:
    path = scope.get("path") or "/"
    if isinstance(path, bytes):
        path = path.decode("latin1")
    path = str(path)
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path


def _protected(scope: Scope) -> bool:
    method = str(scope.get("method") or "GET").upper()
    if method in {"GET", "HEAD", "OPTIONS"}:
        return False
    return _path(scope) in PROTECTED_PATHS


def _bearer_state(scope: Scope) -> str:
    """ok, missing, invalid, or not_configured. Does not echo the secret."""
    secret = os.environ.get("KRONOS_API_SECRET", "").strip()
    header = _header(scope, b"authorization")
    if header is None or not header.lower().startswith(b"bearer "):
        return "not_configured" if not secret else "missing"
    if not secret:
        return "not_configured"
    token = header[7:].strip().decode("utf-8", "replace")
    if tokens_match(token, secret):
        return "ok"
    return "invalid"


async def _reject(send: Send, status: int, detail: str) -> None:
    body = ('{"detail":"%s"}' % detail).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body, "more_body": False})


class IngressMiddleware:
    def __init__(self, app: ASGIApp, max_body: int | None = None) -> None:
        self.app = app
        self.max_body = DEFAULT_MAX_BODY if max_body is None else max_body

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method") or "GET").upper()
        declared = _content_length(scope)
        if declared is not None and declared > self.max_body:
            await _reject(send, 413, "body_too_large")
            return

        if method in {"GET", "HEAD", "OPTIONS"}:
            await self.app(scope, receive, send)
            return

        buffered: list[Message] = []
        total = 0
        while True:
            message = await receive()
            if message.get("type") != "http.request":
                buffered.append(message)
                break
            chunk = message.get("body") or b""
            if not isinstance(chunk, (bytes, bytearray)):
                chunk = bytes(chunk)
            total += len(chunk)
            buffered.append(message)
            if total > self.max_body:
                await _reject(send, 413, "body_too_large")
                return
            if not message.get("more_body", False):
                break

        if _protected(scope):
            state = _bearer_state(scope)
            if state == "not_configured":
                await _reject(send, 500, "not_configured")
                return
            if state != "ok":
                detail = "missing_bearer" if state == "missing" else "invalid_token"
                await _reject(send, 401, detail)
                return

        index = 0

        async def replay() -> Message:
            nonlocal index
            if index < len(buffered):
                message = buffered[index]
                index += 1
                return message
            return await receive()

        await self.app(scope, replay, send)
