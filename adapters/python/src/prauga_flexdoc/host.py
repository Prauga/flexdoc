from __future__ import annotations

from dataclasses import dataclass
from html import escape
from importlib.resources import files
from pathlib import Path
import hashlib
import json
from typing import Literal


def _safe_json(value: object) -> str:
    return (
        json.dumps(value, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


@dataclass(frozen=True)
class FlexDocConfig:
    path: str = "/docs"
    spec_url: str = "/openapi.json"
    title: str = "API Reference"
    theme: str = "system"
    try_it_enabled: bool = True
    expand: str | list[str] | None = None
    try_it_default_server: str | None = None
    try_it_credentials: Literal["omit", "same-origin", "include"] | None = None
    try_it_api_client_persistence_key: str | Literal[False] | None = None


@dataclass(frozen=True)
class FlexDocResponse:
    status: int
    content_type: str
    body: bytes
    cache_control: str | None = None


class FlexDocHost:
    """Framework-neutral synchronous host shared by ASGI, WSGI, Flask, and Django."""

    def __init__(self, config: FlexDocConfig = FlexDocConfig(), *, assets_dir: str | Path | None = None):
        self.config = config
        self.path = "/" + config.path.strip("/")
        self.assets_dir = Path(assets_dir) if assets_dir is not None else None
        digest = hashlib.sha256()
        for name in ("flexdoc.standalone.js", "flexdoc.standalone.css"):
            digest.update(self._read_asset(name))
            digest.update(b"\0")
        self.renderer_version = digest.hexdigest()[:16]

    def route(self, request_path: str) -> FlexDocResponse:
        if request_path in (self.path, self.path + "/"):
            return FlexDocResponse(200, "text/html; charset=utf-8", self.html().encode(), "no-cache")
        if request_path == self.path + "/__flexdoc/renderer.js":
            return FlexDocResponse(
                200,
                "application/javascript; charset=utf-8",
                self._read_asset("flexdoc.standalone.js"),
                "public, max-age=31536000, immutable",
            )
        if request_path == self.path + "/__flexdoc/renderer.css":
            return FlexDocResponse(
                200,
                "text/css; charset=utf-8",
                self._read_asset("flexdoc.standalone.css"),
                "public, max-age=31536000, immutable",
            )
        return FlexDocResponse(404, "text/plain; charset=utf-8", b"Not Found")

    def _read_asset(self, name: str) -> bytes:
        if self.assets_dir is not None:
            return (self.assets_dir / name).read_bytes()
        return files("prauga_flexdoc").joinpath("_assets", name).read_bytes()

    def html(self) -> str:
        try_it: dict[str, object] = {"enabled": self.config.try_it_enabled}
        if self.config.try_it_default_server is not None:
            try_it["defaultServer"] = self.config.try_it_default_server
        if self.config.try_it_credentials is not None:
            try_it["credentials"] = self.config.try_it_credentials
        if self.config.try_it_api_client_persistence_key is not None:
            try_it["apiClientPersistenceKey"] = self.config.try_it_api_client_persistence_key

        options: dict[str, object] = {
            "contractVersion": "1",
            "title": self.config.title,
            "theme": self.config.theme,
            "tryIt": try_it,
        }
        if self.config.expand is not None:
            options["expand"] = self.config.expand

        return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{escape(self.config.title)}</title><link rel="stylesheet" href="{self.path}/__flexdoc/renderer.css?v={self.renderer_version}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={_safe_json(self.config.spec_url)};window.__FLEXDOC_OPTIONS__={_safe_json(options)};</script><script src="{self.path}/__flexdoc/renderer.js?v={self.renderer_version}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>'''
