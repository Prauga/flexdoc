from __future__ import annotations

from dataclasses import dataclass
from html import escape
from importlib.resources import files
from pathlib import Path
import hashlib
import json


def _safe_json(value: object) -> str:
    return json.dumps(value, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


@dataclass(frozen=True)
class FlexDocConfig:
    path: str = "/docs"
    spec_url: str = "/openapi.json"
    title: str = "API Reference"
    theme: str = "system"
    try_it_enabled: bool = True


class FlexDocASGI:
    """Small self-contained ASGI app for FastAPI, Starlette, Django ASGI, and other ASGI hosts."""

    def __init__(self, config: FlexDocConfig = FlexDocConfig(), *, assets_dir: str | Path | None = None):
        self.config = config
        self.path = "/" + config.path.strip("/")
        self.assets_dir = Path(assets_dir) if assets_dir is not None else None
        digest = hashlib.sha256()
        try:
            for name in ("flexdoc.standalone.js", "flexdoc.standalone.css"):
                digest.update(self._read_asset(name))
                digest.update(b"\0")
            self.renderer_version = digest.hexdigest()[:16]
        except OSError:
            self.renderer_version = "unavailable"

    def _read_asset(self, name: str) -> bytes:
        if self.assets_dir is not None:
            return (self.assets_dir / name).read_bytes()
        return files("prauga_flexdoc").joinpath("_assets", name).read_bytes()

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http": return
        request_path = scope.get("path", "")
        if request_path in (self.path, self.path + "/"):
            await self._send(send, 200, "text/html; charset=utf-8", self._html().encode(), [(b"cache-control", b"no-cache")]); return
        if request_path == self.path + "/__flexdoc/renderer.js":
            await self._asset(send, "flexdoc.standalone.js", "application/javascript; charset=utf-8"); return
        if request_path == self.path + "/__flexdoc/renderer.css":
            await self._asset(send, "flexdoc.standalone.css", "text/css; charset=utf-8"); return
        await self._send(send, 404, "text/plain; charset=utf-8", b"Not Found")

    async def _asset(self, send, name: str, content_type: str):
        try: body = self._read_asset(name)
        except OSError:
            await self._send(send, 500, "text/plain; charset=utf-8", b"FlexDoc renderer asset is unavailable"); return
        await self._send(send, 200, content_type, body, [(b"cache-control", b"public, max-age=31536000, immutable")])

    async def _send(self, send, status: int, content_type: str, body: bytes, extra_headers=None):
        headers = [(b"content-type", content_type.encode()), (b"content-length", str(len(body)).encode())]
        headers.extend(extra_headers or [])
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    def _html(self) -> str:
        options = {"contractVersion": "1", "title": self.config.title, "theme": self.config.theme, "tryIt": {"enabled": self.config.try_it_enabled}}
        return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{escape(self.config.title)}</title><link rel="stylesheet" href="{self.path}/__flexdoc/renderer.css?v={self.renderer_version}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={_safe_json(self.config.spec_url)};window.__FLEXDOC_OPTIONS__={_safe_json(options)};</script><script src="{self.path}/__flexdoc/renderer.js?v={self.renderer_version}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>'''
