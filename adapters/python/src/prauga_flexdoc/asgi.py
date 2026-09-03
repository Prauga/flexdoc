from __future__ import annotations

from pathlib import Path

from .host import FlexDocConfig, FlexDocHost


class FlexDocASGI:
    """Self-contained ASGI transport for FastAPI, Starlette, Django ASGI, and other ASGI hosts."""

    def __init__(self, config: FlexDocConfig = FlexDocConfig(), *, assets_dir: str | Path | None = None):
        self.host = FlexDocHost(config, assets_dir=assets_dir)
        self.config = self.host.config
        self.path = self.host.path
        self.renderer_version = self.host.renderer_version

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return
        response = self.host.route(scope.get("path", ""))
        headers = [
            (b"content-type", response.content_type.encode()),
            (b"content-length", str(len(response.body)).encode()),
        ]
        if response.cache_control:
            headers.append((b"cache-control", response.cache_control.encode()))
        await send({"type": "http.response.start", "status": response.status, "headers": headers})
        await send({"type": "http.response.body", "body": response.body})
