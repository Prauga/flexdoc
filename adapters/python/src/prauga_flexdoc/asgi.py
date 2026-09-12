from __future__ import annotations

import asyncio
from collections.abc import Callable
from email import policy
from email.parser import BytesParser
import json
from pathlib import Path
import re

from .host import FlexDocConfig, FlexDocHost
from .host_execution import FlexDocHostExecution, FlexDocHostExecutionFile


MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024
_FILE_PART = re.compile(r"^formData\[(\d+)\]$")


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
            result = self.host_execution.handle(marker, {})
            await self._send_json(send, result.status, result.body)
            return

        try:
            body = await _read_bounded_body(scope, receive)
            content_type = headers.get("content-type", "")
            if "\r" in content_type or "\n" in content_type:
                raise ValueError("Host execution Content-Type is invalid.")
            media_type = content_type.split(";", 1)[0].strip().lower()
            if media_type == "application/json":
                envelope = _parse_json_envelope(body)
                files: dict[int, FlexDocHostExecutionFile] = {}
            elif media_type == "multipart/form-data":
                envelope, files = _parse_multipart_envelope(content_type, body)
            else:
                raise ValueError("Host execution requires application/json or multipart/form-data.")
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


async def _read_bounded_body(scope, receive) -> bytes:
    headers = _scope_headers(scope)
    declared = headers.get("content-length")
    if declared:
        try:
            parsed = int(declared)
            if parsed < 0:
                raise ValueError("Host execution request Content-Length is invalid.")
            if parsed > MAX_EXECUTION_REQUEST_BYTES:
                raise ValueError("Host execution request exceeded the 32 MiB safety limit.")
        except ValueError as error:
            if str(error).startswith("Host execution request exceeded") or str(error).startswith("Host execution request Content-Length"):
                raise
            raise ValueError("Host execution request Content-Length is invalid.") from error

    chunks: list[bytes] = []
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
        chunks.append(bytes(chunk))
        if not message.get("more_body", False):
            break
    return b"".join(chunks)


def _parse_json_envelope(body: bytes) -> dict[str, object]:
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Host execution body must be valid UTF-8 JSON.") from error
    if not isinstance(payload, dict):
        raise ValueError("Host execution body must be a JSON object.")
    return payload


def _parse_multipart_envelope(
    content_type: str,
    body: bytes,
) -> tuple[dict[str, object], dict[int, FlexDocHostExecutionFile]]:
    if "\r" in content_type or "\n" in content_type:
        raise ValueError("Host execution Content-Type is invalid.")
    try:
        message = BytesParser(policy=policy.default).parsebytes(
            b"Content-Type: " + content_type.encode("latin-1") + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
        )
    except (UnicodeEncodeError, ValueError) as error:
        raise ValueError("Host execution multipart body is invalid.") from error
    if not message.is_multipart():
        raise ValueError("Host execution multipart body is invalid.")

    descriptor: bytes | None = None
    files: dict[int, FlexDocHostExecutionFile] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not isinstance(name, str):
            continue
        payload = part.get_payload(decode=True) or b""
        if name == "descriptor":
            if descriptor is not None:
                raise ValueError("Host execution multipart request contains multiple descriptors.")
            descriptor = payload
            continue
        match = _FILE_PART.fullmatch(name)
        if not match:
            continue
        index = int(match.group(1))
        if index in files:
            raise ValueError(f"Host execution multipart request contains duplicate formData[{index}] parts.")
        files[index] = FlexDocHostExecutionFile(
            filename=part.get_filename(),
            content_type=part.get_content_type(),
            data=payload,
        )

    if descriptor is None:
        raise ValueError("Host execution multipart request requires a descriptor.")
    return _parse_json_envelope(descriptor), files
