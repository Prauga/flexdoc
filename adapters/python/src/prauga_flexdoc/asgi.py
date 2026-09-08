from __future__ import annotations

from collections.abc import Callable
import json
from pathlib import Path

from .host import FlexDocConfig, FlexDocHost


class FlexDocASGI:
    """Self-contained ASGI transport for FastAPI, Starlette, Django ASGI, and other ASGI hosts."""

    def __init__(
        self,
        config: FlexDocConfig = FlexDocConfig(),
        *,
        assets_dir: str | Path | None = None,
        runtime_provider: Callable[[dict], dict] | None = None,
        runtime_framework: str | None = None,
    ):
        """Create an ASGI application that serves FlexDoc routes.

        Args:
            config: Renderer and route settings for the docs subtree.
            assets_dir: Optional directory overriding the bundled renderer assets.
            runtime_provider: Optional callable that returns a runtime intelligence
                snapshot for ``GET {path}/__flexdoc/runtime``.
            runtime_framework: Framework name included in renderer options when
                ``runtime_provider`` is set.
        """
        self.runtime_provider = runtime_provider
        self.host = FlexDocHost(
            config,
            assets_dir=assets_dir,
            runtime_intelligence_framework=runtime_framework if runtime_provider is not None else None,
        )
        self.config = self.host.config
        self.path = self.host.path
        self.renderer_version = self.host.renderer_version

    async def __call__(self, scope, receive, send):
        """Serve one ASGI connection/request.

        Args:
            scope: ASGI connection scope. Non-HTTP scopes are ignored.
            receive: ASGI receive callable. FlexDoc currently serves GET-only/static responses and does not consume request bodies.
            send: ASGI send callable used for response start/body events.
        """
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

        response = self.host.route(request_path)
        headers = [
            (b"content-type", response.content_type.encode()),
            (b"content-length", str(len(response.body)).encode()),
        ]
        if response.cache_control:
            headers.append((b"cache-control", response.cache_control.encode()))
        await send({"type": "http.response.start", "status": response.status, "headers": headers})
        await send({"type": "http.response.body", "body": response.body})

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