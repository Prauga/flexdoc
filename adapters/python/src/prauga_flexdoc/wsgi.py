from __future__ import annotations

from http import HTTPStatus
import json
from pathlib import Path

from .host import FlexDocConfig, FlexDocHost
from .host_execution import FlexDocHostExecution
from .host_execution_envelope import (
    MAX_EXECUTION_REQUEST_BYTES,
    parse_execute_envelope,
    validate_declared_length,
)


class FlexDocWSGI:
    """Self-contained WSGI transport for Flask, Django WSGI, and other WSGI hosts."""

    def __init__(
        self,
        config: FlexDocConfig = FlexDocConfig(),
        *,
        assets_dir: str | Path | None = None,
        host_execution: FlexDocHostExecution | None = None,
    ):
        """Create a WSGI application that serves FlexDoc routes.

        Args:
            config: Renderer and route settings for the docs subtree.
            assets_dir: Optional directory overriding the bundled renderer assets.
            host_execution: Optional real native executor for ``POST {path}/__flexdoc/execute``.
        """
        self.host_execution = host_execution
        self.host = FlexDocHost(
            config,
            assets_dir=assets_dir,
            host_execution_available=host_execution is not None,
            host_execution_capabilities=host_execution.capabilities if host_execution is not None else (),
        )
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
        request_path = environ.get("PATH_INFO", "")
        if self.host_execution is not None and request_path == self.path + "/__flexdoc/execute":
            return self._execute(environ, start_response)

        response = self.host.route(request_path)
        headers = [
            ("Content-Type", response.content_type),
            ("Content-Length", str(len(response.body))),
        ]
        if response.cache_control:
            headers.append(("Cache-Control", response.cache_control))
        start_response(f"{response.status} {HTTPStatus(response.status).phrase}", headers)
        return [response.body]

    def _execute(self, environ, start_response):
        if str(environ.get("REQUEST_METHOD") or "GET").upper() != "POST":
            return _send_json(start_response, 405, {"error": "Method not allowed."})

        marker = environ.get("HTTP_X_FLEXDOC_EXECUTE")
        if marker != "1":
            result = self.host_execution.handle(marker, {})
            return _send_json(start_response, result.status, result.body)

        try:
            chunks = read_bounded_wsgi_body(environ)
            envelope, files = parse_execute_envelope(environ.get("CONTENT_TYPE", ""), chunks)
        except LengthRequired as error:
            return _send_json(start_response, 411, {"error": str(error)})
        except ValueError as error:
            return _send_json(start_response, 400, {"error": str(error)})

        result = self.host_execution.handle(marker, envelope, files)
        return _send_json(start_response, result.status, result.body)


class LengthRequired(ValueError):
    """Raised when a WSGI execute request supplies no length and no terminated stream to read."""


def read_bounded_wsgi_body(environ) -> list[bytes | bytearray]:
    """Read a bounded execute body from a WSGI input stream without reading past the request.

    A WSGI server is only required to provide readable input up to ``CONTENT_LENGTH``, so an
    unbounded read can block. Chunked requests are read incrementally, and only when the server
    reports a terminated stream.
    """
    declared = validate_declared_length(environ.get("CONTENT_LENGTH"))
    stream = environ.get("wsgi.input")
    if stream is None:
        return []

    if declared is None:
        chunked = "chunked" in str(environ.get("HTTP_TRANSFER_ENCODING") or "").lower()
        if not (chunked and environ.get("wsgi.input_terminated")):
            raise LengthRequired("Host execution requires a Content-Length.")
        return _read_terminated_stream(stream)

    chunks: list[bytes | bytearray] = []
    remaining = declared
    while remaining > 0:
        chunk = stream.read(min(remaining, 64 * 1024))
        if not chunk:
            raise ValueError("Host execution request body was interrupted.")
        if not isinstance(chunk, (bytes, bytearray)):
            raise ValueError("Host execution request body is invalid.")
        remaining -= len(chunk)
        chunks.append(chunk)
    return chunks


def _read_terminated_stream(stream) -> list[bytes | bytearray]:
    chunks: list[bytes | bytearray] = []
    size = 0
    while True:
        chunk = stream.read(64 * 1024)
        if not chunk:
            break
        if not isinstance(chunk, (bytes, bytearray)):
            raise ValueError("Host execution request body is invalid.")
        size += len(chunk)
        if size > MAX_EXECUTION_REQUEST_BYTES:
            raise ValueError("Host execution request exceeded the 32 MiB safety limit.")
        chunks.append(chunk)
    return chunks


def _send_json(start_response, status: int, payload: object) -> list[bytes]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    start_response(
        f"{status} {HTTPStatus(status).phrase}",
        [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
        ],
    )
    return [body]
