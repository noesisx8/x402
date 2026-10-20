"""Ingress limits. Stdlib only — do not import app.main (pandas/torch)."""

from __future__ import annotations

import asyncio
import os
import unittest
from pathlib import Path

from app.ingress import DEFAULT_MAX_BODY, IngressMiddleware


def _scope(method: str, path: str, headers: list[tuple[str, str]] | None = None) -> dict:
    return {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or [])],
    }


class Recorder:
    def __init__(self) -> None:
        self.calls = 0
        self.bodies: list[bytes] = []

    async def __call__(self, scope, receive, send) -> None:
        self.calls += 1
        body = b""
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                break
            if message["type"] != "http.request":
                continue
            body += message.get("body") or b""
            if not message.get("more_body", False):
                break
        self.bodies.append(body)
        payload = b"ok"
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"text/plain")],
            }
        )
        await send({"type": "http.response.body", "body": payload, "more_body": False})


async def _invoke(app, scope, messages, receive_calls: list[int] | None = None):
    sent: list[dict] = []
    queue = list(messages)

    async def receive():
        if receive_calls is not None:
            receive_calls[0] += 1
        if not queue:
            return {"type": "http.disconnect"}
        return queue.pop(0)

    async def send(message):
        sent.append(message)

    await app(scope, receive, send)
    return sent


def _status(sent: list[dict]) -> int:
    for message in sent:
        if message["type"] == "http.response.start":
            return int(message["status"])
    return 0


class IngressTests(unittest.TestCase):
    def setUp(self) -> None:
        self._secret = os.environ.get("KRONOS_API_SECRET")
        os.environ["KRONOS_API_SECRET"] = "test-secret"

    def tearDown(self) -> None:
        if self._secret is None:
            os.environ.pop("KRONOS_API_SECRET", None)
        else:
            os.environ["KRONOS_API_SECRET"] = self._secret

    def test_content_length_rejects_before_app_and_before_auth(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=64)
        reads = [0]
        sent = asyncio.run(
            _invoke(
                mw,
                _scope("POST", "/v1/forecast", [("content-length", "1000000")]),
                [{"type": "http.request", "body": b"x" * 100, "more_body": False}],
                reads,
            )
        )
        self.assertEqual(_status(sent), 413)
        self.assertEqual(app.calls, 0)
        self.assertEqual(reads[0], 0)
        body = next(m["body"] for m in sent if m["type"] == "http.response.body")
        self.assertIn(b"body_too_large", body)

    def test_chunked_oversize_never_reaches_app(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=64)
        sent = asyncio.run(
            _invoke(
                mw,
                _scope("POST", "/v1/forecast", [("authorization", "Bearer test-secret")]),
                [
                    {"type": "http.request", "body": b"a" * 40, "more_body": True},
                    {"type": "http.request", "body": b"b" * 40, "more_body": False},
                ],
            )
        )
        self.assertEqual(_status(sent), 413)
        self.assertEqual(app.calls, 0)

    def test_missing_bearer_is_401_before_app(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=DEFAULT_MAX_BODY)
        sent = asyncio.run(
            _invoke(
                mw,
                _scope("POST", "/v1/forecast", [("content-type", "application/json")]),
                [{"type": "http.request", "body": b'{"symbol":"BTCUSDT"}', "more_body": False}],
            )
        )
        self.assertEqual(_status(sent), 401)
        self.assertEqual(app.calls, 0)
        body = next(m["body"] for m in sent if m["type"] == "http.response.body")
        self.assertIn(b"missing_bearer", body)

    def test_valid_bearer_replays_body(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=DEFAULT_MAX_BODY)
        payload = b'{"symbol":"BTCUSDT","interval":"1h"}'
        sent = asyncio.run(
            _invoke(
                mw,
                _scope(
                    "POST",
                    "/v1/forecast",
                    [
                        ("authorization", "Bearer test-secret"),
                        ("content-type", "application/json"),
                    ],
                ),
                [{"type": "http.request", "body": payload, "more_body": False}],
            )
        )
        self.assertEqual(_status(sent), 200)
        self.assertEqual(app.calls, 1)
        self.assertEqual(app.bodies, [payload])

    def test_get_health_is_not_blocked(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=32)
        sent = asyncio.run(
            _invoke(
                mw,
                _scope("GET", "/health"),
                [{"type": "http.request", "body": b"", "more_body": False}],
            )
        )
        self.assertEqual(_status(sent), 200)
        self.assertEqual(app.calls, 1)

    def test_slow_oversize_does_not_block_health(self) -> None:
        app = Recorder()
        mw = IngressMiddleware(app, max_body=1024)
        blocked = asyncio.Event()
        release = asyncio.Event()

        async def slow_receive():
            if not blocked.is_set():
                blocked.set()
                return {"type": "http.request", "body": b"a", "more_body": True}
            await release.wait()
            return {"type": "http.request", "body": b"b" * 2048, "more_body": False}

        async def health_receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        oversize_sent: list[dict] = []
        health_sent: list[dict] = []

        async def send_oversize(message):
            oversize_sent.append(message)

        async def send_health(message):
            health_sent.append(message)

        async def scenario():
            flood = asyncio.create_task(
                mw(
                    _scope("POST", "/v1/forecast", [("authorization", "Bearer test-secret")]),
                    slow_receive,
                    send_oversize,
                )
            )
            await asyncio.wait_for(blocked.wait(), timeout=1)
            await asyncio.wait_for(
                mw(_scope("GET", "/health"), health_receive, send_health),
                timeout=1,
            )
            self.assertFalse(release.is_set())
            self.assertEqual(_status(health_sent), 200)
            release.set()
            await asyncio.wait_for(flood, timeout=1)

        asyncio.run(scenario())
        self.assertEqual(_status(oversize_sent), 413)
        self.assertEqual(app.calls, 1)

    def test_uvicorn_command_caps_concurrency(self) -> None:
        root = Path(__file__).resolve().parents[1]
        docker = (root / "Dockerfile").read_text()
        railway = (root / "railway.toml").read_text()
        for text in (docker, railway):
            self.assertIn("--http h11", text)
            self.assertIn("--limit-concurrency", text)
            self.assertIn("UVICORN_LIMIT_CONCURRENCY:-16", text)
            self.assertTrue("sh -c" in text or '"sh", "-c"' in text)


if __name__ == "__main__":
    unittest.main()
