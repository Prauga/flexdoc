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
    """FlexDoc renderer configuration passed to hosts and framework helpers.

    Attributes:
        path: URL prefix where the docs shell and renderer assets are served.
        spec_url: OpenAPI document URL resolved by the browser bootstrap page.
        title: Page and renderer title shown in the docs shell.
        theme: Renderer theme preset: ``"system"``, ``"light"``, or ``"dark"``.
        try_it_enabled: Whether the Try It client is enabled in the renderer.
        expand: Optional expansion preset or section list forwarded to the renderer.
        try_it_default_server: Optional default server URL for Try It requests.
        try_it_credentials: Optional fetch credentials mode for Try It requests.
        try_it_api_client_persistence_key: Optional persistence key, or ``False`` to disable.
        try_it_host_execution: Requests host-execution protocol metadata. ``available``
            remains false unless the serving transport attaches a real native executor.
    """

    path: str = "/docs"
    spec_url: str = "/openapi.json"
    title: str = "API Reference"
    theme: str = "system"
    try_it_enabled: bool = True
    expand: str | list[str] | None = None
    try_it_default_server: str | None = None
    try_it_credentials: Literal["omit", "same-origin", "include"] | None = None
    try_it_api_client_persistence_key: str | Literal[False] | None = None
    try_it_host_execution: bool = False


@dataclass(frozen=True)
class FlexDocResponse:
    """HTTP response produced by :class:`FlexDocHost` route matching.

    Attributes:
        status: HTTP status code returned by the host route.
        content_type: Content-Type header value for the response body.
        body: Raw response body bytes.
        cache_control: Optional Cache-Control header value.
    """

    status: int
    content_type: str
    body: bytes
    cache_control: str | None = None


class FlexDocHost:
    """Framework-neutral synchronous host shared by ASGI, WSGI, Flask, and Django."""

    def __init__(
        self,
        config: FlexDocConfig = FlexDocConfig(),
        *,
        assets_dir: str | Path | None = None,
        runtime_intelligence_framework: str | None = None,
        host_execution_available: bool = False,
        host_execution_capabilities: list[str] | tuple[str, ...] = (),
    ):
        """Create a host that serves the docs shell and packaged renderer assets.

        Args:
            config: Renderer and route settings for the docs subtree.
            assets_dir: Optional directory overriding the bundled renderer assets.
            runtime_intelligence_framework: Framework name advertised when runtime
                intelligence is enabled by an ASGI transport.
            host_execution_available: Whether the owning transport has a real execute route.
            host_execution_capabilities: Native host-only capabilities advertised when available.
        """
        self.config = config
        self.path = "/" + config.path.strip("/")
        self.assets_dir = Path(assets_dir) if assets_dir is not None else None
        self.runtime_intelligence_framework = runtime_intelligence_framework
        self.host_execution_available = bool(host_execution_available)
        self.host_execution_capabilities = tuple(host_execution_capabilities)
        digest = hashlib.sha256()
        for name in ("flexdoc.standalone.js", "flexdoc.standalone.css"):
            digest.update(self._read_asset(name))
            digest.update(b"\0")
        self.renderer_version = digest.hexdigest()[:16]

    def route(self, request_path: str) -> FlexDocResponse:
        """Match one request path against the FlexDoc documentation subtree.

        Args:
            request_path: Absolute request path to match, without query-string handling.

        Returns:
            A docs-shell, renderer-asset, or ``404`` response envelope.
        """
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
        """Render the standalone FlexDoc bootstrap page for this host.

        Returns:
            HTML that loads the configured OpenAPI document and bundled canonical renderer.
        """
        try_it: dict[str, object] = {"enabled": self.config.try_it_enabled}
        if self.config.try_it_default_server is not None:
            try_it["defaultServer"] = self.config.try_it_default_server
        if self.config.try_it_credentials is not None:
            try_it["credentials"] = self.config.try_it_credentials
        if self.config.try_it_api_client_persistence_key is not None:
            try_it["apiClientPersistenceKey"] = self.config.try_it_api_client_persistence_key
        if self.config.try_it_host_execution:
            try_it["hostExecution"] = {
                "available": self.host_execution_available,
                "endpoint": self.path + "/__flexdoc/execute",
                "capabilities": list(self.host_execution_capabilities) if self.host_execution_available else [],
            }

        options: dict[str, object] = {
            "contractVersion": "1",
            "title": self.config.title,
            "theme": self.config.theme,
            "tryIt": try_it,
        }
        if self.config.expand is not None:
            options["expand"] = self.config.expand
        if self.runtime_intelligence_framework:
            options["runtimeIntelligence"] = {
                "available": True,
                "endpoint": self.path + "/__flexdoc/runtime",
                "framework": self.runtime_intelligence_framework,
            }

        return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{escape(self.config.title)}</title><link rel="stylesheet" href="{self.path}/__flexdoc/renderer.css?v={self.renderer_version}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={_safe_json(self.config.spec_url)};window.__FLEXDOC_OPTIONS__={_safe_json(options)};</script><script src="{self.path}/__flexdoc/renderer.js?v={self.renderer_version}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>'''
