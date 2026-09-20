from __future__ import annotations

import asyncio
from collections.abc import Callable
import json
from pathlib import Path

from .host import FlexDocConfig, FlexDocHost
from .host_execution import FlexDocHostExecution
from .host_execution_envelope import (
    MAX_EXECUTION_REQUEST_BYTES,
    parse_execute_envelope,
    validate_declared_length,
)


class FlexDocASGI:
    """Self-contained ASGI transport for FastAPI, Starlette, Django ASGI, and other ASGI hosts."""

    def __init__(
        self,
        config: FlexDocConfig = FlexDocConfig(),
        *,
        assets_dir: str | Path | None = None,
        runtime_provider: Callable[[dict], dict] | None = None,
        runtime_framework: str | None = None,
        host_execution: FlexDocHostExecution | None = None,
    ):
        """Create an ASGI application that serves FlexDoc routes.

        Args:
            config: Renderer and route settings for the docs subtree.
            assets_dir: Optional directory overriding the bundled renderer assets.
            runtime_provider: Optional callable that returns a runtime intelligence
                snapshot for ``GET {path}/__flexdoc/runtime``.
            runtime_framework: Framework name included in renderer options when
                ``runtime_provider`` is set.
            host_execution: Optional real native executor for ``POST {path}/__flexdoc/execute``.
        """
        self.runtime_provider = runtime_provider
        self.host_execution = host_execution
        self.host = FlexDocHost(
            config,
            assets_dir=assets_dir,
            runtime_intelligence_framework=runtime_framework if runtime_provider is not None else None,
            host_execution_available=host_execution is not None,
            host_execution_capabilities=host_execution.capabilities if host_execution is not None else (),
        )
        self.config = self.host.config
        self.path = self.host.path
        self.renderer_version = self.host.renderer_version

    async def __call__(self, scope, receive, send):
        """Serve one ASGI connection/request."""
        if scope.get("type") != "http":
            return

        request_path = scope.get("path", "")
        if self.runtime_provider is not None and request_path == self.path + "/__flexdoc/runtime":
            if str(scope.get("method") or "GET").upper() != "GET":
                await self._send_json(send, 405, {"error": "Method not allowed."})
                return
            try:
                snapshot = self.runtime_provider(scope)
            except Exception:
                await self._send_json(send, 500, {"error": "Runtime intelligence unavailable."})
                return
            await self._send_json(send, 200, snapshot)
            return

        if self.host_execution is not None and request_path == self.path + "/__flexdoc/execute":
            await self._execute(scope, receive, send)
            return

        response = self.host.route(request_path)
        headers = [
            (b"content-type", response.content_type.encode()),
            (b"content-length", str(len(response.body)).encode()),
        ]
        if response.cache_control:
            headers.append((b"cache-control", response.cache_control.encode()))
        await send({"type": "http.response.start", "status": response.status, "headers": headers})
        await send({"type": "http.response.body", "body": response.body})

    async def _execute(self, scope, receive, send) -> None:
        if str(scope.get("method") or "GET").upper() != "POST":
            await self._send_json(send, 405, {"error": "Method not allowed."})
            return
        headers = _scope_headers(scope)
        marker = headers.get("x-flexdoc-execute")
        if marker != "1":
            result = await asyncio.to_thread(self.host_execution.handle, marker, {})
            await self._send_json(send, result.status, result.body)
            return

        try:
            chunks = await _read_bounded_body(scope, receive)
            content_type = headers.get("content-type", "")
            envelope, files = await asyncio.to_thread(parse_execute_envelope, content_type, chunks)
        except ValueError as error:
            await self._send_json(send, 400, {"error": str(error)})
            return

        result = await asyncio.to_thread(self.host_execution.handle, marker, envelope, files)
        await self._send_json(send, result.status, result.body)

    @staticmethod
    async def _send_json(send, status: int, payload: object) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = [
            (b"content-type", b"application/json; charset=utf-8"),
            (b"content-length", str(len(body)).encode()),
            (b"cache-control", b"no-store"),
        ]
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})


def _scope_headers(scope) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_name, raw_value in scope.get("headers") or []:
        try:
            name = raw_name.decode("latin-1").lower()
            value = raw_value.decode("latin-1")
        except (AttributeError, UnicodeDecodeError):
            continue
        result[name] = value
    return result


async def _read_bounded_body(scope, receive) -> list[bytes | bytearray]:
    """Receive bounded ASGI body chunks without copying or assembling them on the event loop."""
    validate_declared_length(_scope_headers(scope).get("content-length"))

    chunks: list[bytes | bytearray] = []
    size = 0
    while True:
        message = await receive()
        if not isinstance(message, dict) or message.get("type") != "http.request":
            raise ValueError("Host execution request body was interrupted.")
        chunk = message.get("body", b"")
        if not isinstance(chunk, (bytes, bytearray)):
            raise ValueError("Host execution request body is invalid.")
        size += len(chunk)
        if size > MAX_EXECUTION_REQUEST_BYTES:
            raise ValueError("Host execution request exceeded the 32 MiB safety limit.")
        chunks.append(chunk)
        if not message.get("more_body", False):
            break
    return chunks
