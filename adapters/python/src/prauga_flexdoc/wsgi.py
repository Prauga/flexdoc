from __future__ import annotations

from http import HTTPStatus
from pathlib import Path

from .host import FlexDocConfig, FlexDocHost


class FlexDocWSGI:
    """Self-contained WSGI transport for Flask, Django WSGI, and other WSGI hosts."""

    def __init__(self, config: FlexDocConfig = FlexDocConfig(), *, assets_dir: str | Path | None = None):
        """Create a WSGI application that serves FlexDoc routes.

        Args:
            config: Renderer and route settings for the docs subtree.
            assets_dir: Optional directory overriding the bundled renderer assets.
        """
        self.host = FlexDocHost(config, assets_dir=assets_dir)
        self.config = self.host.config
        self.path = self.host.path
        self.renderer_version = self.host.renderer_version

    def __call__(self, environ, start_response):
        """Serve one WSGI request.

        Args:
            environ: WSGI environment mapping containing ``PATH_INFO``.
            start_response: WSGI callback used to send status and response headers.

        Returns:
            Single-chunk iterable containing the response body bytes.
        """
        response = self.host.route(environ.get("PATH_INFO", ""))
        phrase = HTTPStatus(response.status).phrase
        headers = [
            ("Content-Type", response.content_type),
            ("Content-Length", str(len(response.body))),
        ]
        if response.cache_control:
            headers.append(("Cache-Control", response.cache_control))
        start_response(f"{response.status} {phrase}", headers)
        return [response.body]