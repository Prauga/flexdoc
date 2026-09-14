from __future__ import annotations

from dataclasses import dataclass
import base64
import binascii
import http.client
import ipaddress
import json
import math
import re
import socket
import ssl
import time
import uuid
from urllib.parse import quote, urlencode, urljoin, urlsplit, urlunsplit


MAX_RESPONSE_BYTES = 10 * 1024 * 1024
DEFAULT_TIMEOUT_MS = 30_000
MIN_TIMEOUT_MS = 100
MAX_TIMEOUT_MS = 120_000
MAX_REDIRECTS = 5

_METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
_FORBIDDEN_HEADERS = {"host", "content-length", "set-cookie", "origin", "referer"}
_HEADER_NAME = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")
_METADATA_HOSTS = {
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.google",
    "fe80::a9fe:a9fe",
}


class FlexDocHostExecutionError(RuntimeError):
    """Typed error mapped onto the canonical host-execution JSON response."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class FlexDocHostExecutionFile:
    """One browser-uploaded multipart file indexed by canonical form-data position."""

    filename: str | None
    content_type: str | None
    data: bytes


@dataclass(frozen=True)
class FlexDocHostExecutionResult:
    """Status and JSON body returned by the native execute route."""

    status: int
    body: dict[str, object]


@dataclass(frozen=True)
class _PreparedBody:
    data: bytes | None
    content_type: str | None


@dataclass(frozen=True)
class _ValidatedAddress:
    family: int
    protocol: int
    sockaddr: tuple[object, ...]


class FlexDocHostExecution:
    """Framework-neutral synchronous executor for the existing FlexDoc execute envelope."""

    def __init__(self, allowed_origins: list[str] | tuple[str, ...]):
        if not allowed_origins:
            raise ValueError("Python host execution requires at least one exact allowed origin.")
        self.allowed_origins = frozenset(_normalize_allowed_origin(value) for value in allowed_origins)

    @property
    def capabilities(self) -> list[str]:
        """Native host-only capabilities advertised to the renderer."""
        return []

    def handle(
        self,
        execute_marker: str | None,
        envelope: dict[str, object] | None,
        files: dict[int, FlexDocHostExecutionFile] | None = None,
    ) -> FlexDocHostExecutionResult:
        """Validate the execute marker and map executor failures to canonical JSON errors."""
        if execute_marker != "1":
            return FlexDocHostExecutionResult(403, {"error": "Missing X-FlexDoc-Execute header."})
        try:
            return FlexDocHostExecutionResult(200, self.execute(envelope, files))
        except FlexDocHostExecutionError as error:
            return FlexDocHostExecutionResult(error.status, {"error": str(error)})
        except Exception:
            return FlexDocHostExecutionResult(502, {"error": "API host execution failed."})

    def execute(
        self,
        envelope: dict[str, object] | None,
        files: dict[int, FlexDocHostExecutionFile] | None = None,
    ) -> dict[str, object]:
        """Execute one already-parsed canonical host-execution envelope."""
        if not isinstance(envelope, dict):
            raise _bad_request("Host execution body must be a JSON object.")
        if envelope.get("cookieJar") == "session":
            raise _unsupported("Session cookie jars are not implemented by the Python host executor.")
        if _string(envelope.get("certificateId")):
            raise _unsupported("Client certificates are not implemented by the Python host executor.")

        draft = _object(envelope.get("request"), "Host execution body requires a canonical request draft.")
        raw_url = _string(draft.get("url"))
        if raw_url is None or not raw_url.strip():
            raise _bad_request("Host execution requires an absolute request URL.")
        url = _parse_target(raw_url)
        url = _append_query(url, _entries(draft.get("query")))

        method = (_string(draft.get("method")) or "GET").strip().upper()
        if method not in _METHODS:
            raise _bad_request(f"Unsupported host execution HTTP method: {method}")

        headers = _sanitize_headers(_entries(draft.get("headers")))
        _apply_header_auth(draft.get("auth"), headers)
        body_mode = _infer_body_mode(draft)
        prepared = _prepare_body(draft, envelope, files or {}, body_mode)
        if body_mode == "formdata":
            _delete_header(headers, "Content-Type")
        if prepared.content_type and _header(headers, "Content-Type") is None:
            _set_header(headers, "Content-Type", prepared.content_type)

        timeout_value = envelope.get("timeoutMs")
        if isinstance(timeout_value, (int, float)) and not isinstance(timeout_value, bool) and math.isfinite(timeout_value):
            timeout_ms = int(timeout_value)
        else:
            timeout_ms = DEFAULT_TIMEOUT_MS
        timeout_ms = max(MIN_TIMEOUT_MS, min(MAX_TIMEOUT_MS, timeout_ms))
        return self._execute_with_redirects(
            method,
            url,
            headers,
            prepared.data,
            timeout_ms,
            draft.get("auth"),
        )

    def _execute_with_redirects(
        self,
        initial_method: str,
        initial_url: str,
        initial_headers: list[tuple[str, str]],
        initial_body: bytes | None,
        timeout_ms: int,
        raw_auth: object,
    ) -> dict[str, object]:
        method = initial_method
        url = initial_url
        headers = list(initial_headers)
        body = initial_body

        for redirect_count in range(MAX_REDIRECTS + 1):
            target = _apply_query_auth(raw_auth, url)
            started = time.perf_counter()
            deadline = time.monotonic() + timeout_ms / 1000.0
            validated_addresses = self._assert_allowed(target)
            if time.monotonic() >= deadline:
                raise _upstream(f"Host execution request timed out after {timeout_ms} ms.")
            status, status_text, response_headers, response_body, location = _request_once(
                target,
                method,
                headers,
                body,
                deadline,
                timeout_ms,
                validated_addresses,
            )
            elapsed_ms = max(0, int((time.perf_counter() - started) * 1000))

            if status in {301, 302, 303, 307, 308} and location:
                if redirect_count >= MAX_REDIRECTS:
                    raise _forbidden("Host execution exceeded the redirect safety limit.")
                next_url = urljoin(target, location)
                if _origin(next_url) != _origin(target):
                    raise _forbidden("Host execution does not follow cross-origin redirects.")
                if status == 303:
                    method = "GET"
                    body = None
                    _delete_header(headers, "Content-Type")
                url = next_url
                continue

            return {
                "status": status,
                "statusText": status_text,
                "headers": [[name, value] for name, value in response_headers],
                "body": response_body.decode("utf-8", errors="replace"),
                "responseTime": elapsed_ms,
            }

        raise _forbidden("Host execution exceeded the redirect safety limit.")

    def _assert_allowed(self, url: str) -> tuple[_ValidatedAddress, ...]:
        parts = _split_http_url(url)
        origin = _origin(url)
        if origin not in self.allowed_origins:
            raise _forbidden(f"Origin {origin} is not allowed for host execution.")
        host = parts.hostname
        assert host is not None
        if _is_metadata_host(host):
            raise _forbidden("Host execution blocks link-local and cloud metadata endpoints.")
        port = parts.port or (443 if parts.scheme.lower() == "https" else 80)
        try:
            addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as error:
            raise _upstream("Host execution could not resolve target hostname.") from error
        if not addresses:
            raise _upstream("Host execution could not resolve target hostname.")

        validated: list[_ValidatedAddress] = []
        seen: set[tuple[int, tuple[object, ...]]] = set()
        for family, socktype, protocol, _canonname, sockaddr in addresses:
            if socktype not in {0, socket.SOCK_STREAM}:
                continue
            raw = str(sockaddr[0]).split("%", 1)[0]
            try:
                address = ipaddress.ip_address(raw)
            except ValueError:
                continue
            mapped = getattr(address, "ipv4_mapped", None)
            if address.is_link_local or (mapped is not None and mapped.is_link_local):
                raise _forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
            normalized_sockaddr = tuple(sockaddr)
            key = (family, normalized_sockaddr)
            if key in seen:
                continue
            seen.add(key)
            validated.append(_ValidatedAddress(family, protocol, normalized_sockaddr))

        if not validated:
            raise _upstream("Host execution could not resolve target hostname.")
        return tuple(validated)


def _request_once(
    url: str,
    method: str,
    headers: list[tuple[str, str]],
    body: bytes | None,
    deadline: float,
    timeout_ms: int,
    validated_addresses: tuple[_ValidatedAddress, ...],
) -> tuple[int, str, list[tuple[str, str]], bytes, str | None]:
    parts = _split_http_url(url)
    host = parts.hostname
    assert host is not None
    port = parts.port or (443 if parts.scheme.lower() == "https" else 80)
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise _upstream(f"Host execution request timed out after {timeout_ms} ms.")

    if parts.scheme.lower() == "https":
        connection: http.client.HTTPConnection = http.client.HTTPSConnection(
            host, port, timeout=remaining, context=ssl.create_default_context()
        )
    else:
        connection = http.client.HTTPConnection(host, port, timeout=remaining)
    connection._create_connection = _pinned_connection_factory(validated_addresses)  # type: ignore[attr-defined]

    path = parts.path or "/"
    if parts.query:
        path += "?" + parts.query
    authority = _authority(parts)

    try:
        connection.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
        connection.putheader("Host", authority)
        for name, value in headers:
            connection.putheader(name, value)
        if body is not None and _header(headers, "Content-Length") is None:
            connection.putheader("Content-Length", str(len(body)))
        connection.endheaders(body)

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise _upstream(f"Host execution request timed out after {timeout_ms} ms.")
        if connection.sock is not None:
            connection.sock.settimeout(remaining)
        response = connection.getresponse()
        declared_length = response.getheader("Content-Length")
        if declared_length is not None:
            try:
                if int(declared_length) > MAX_RESPONSE_BYTES:
                    raise _upstream("Host execution response exceeded the 10 MiB safety limit.")
            except ValueError:
                pass
        data = _read_response_body(response, connection, deadline, timeout_ms)
        response_headers = [(str(name), str(value)) for name, value in response.getheaders()]
        return (
            int(response.status),
            str(response.reason or http.client.responses.get(int(response.status), "")),
            response_headers,
            data,
            response.getheader("Location"),
        )
    except FlexDocHostExecutionError:
        raise
    except socket.timeout as error:
        raise _upstream(f"Host execution request timed out after {timeout_ms} ms.") from error
    except (OSError, http.client.HTTPException, ValueError) as error:
        raise _upstream(f"Host execution request failed: {error}") from error
    finally:
        connection.close()


def _pinned_connection_factory(validated_addresses: tuple[_ValidatedAddress, ...]):
    def connect(_address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None):
        last_error: OSError | None = None
        for candidate in validated_addresses:
            sock = socket.socket(candidate.family, socket.SOCK_STREAM, candidate.protocol)
            try:
                if timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                    sock.settimeout(timeout)
                if source_address is not None:
                    sock.bind(source_address)
                sock.connect(candidate.sockaddr)
                return sock
            except OSError as error:
                sock.close()
                last_error = error
        if last_error is not None:
            raise last_error
        raise OSError("Host execution has no validated destination addresses.")

    return connect


def _read_response_body(
    response: http.client.HTTPResponse,
    connection: http.client.HTTPConnection,
    deadline: float,
    timeout_ms: int,
) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise _upstream(f"Host execution request timed out after {timeout_ms} ms.")
        if connection.sock is not None:
            connection.sock.settimeout(remaining)
        try:
            chunk = response.read1(64 * 1024)
        except socket.timeout as error:
            raise _upstream(f"Host execution request timed out after {timeout_ms} ms.") from error
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_RESPONSE_BYTES:
            raise _upstream("Host execution response exceeded the 10 MiB safety limit.")
        chunks.append(chunk)
    return b"".join(chunks)


def _prepare_body(
    draft: dict[str, object],
    envelope: dict[str, object],
    files: dict[int, FlexDocHostExecutionFile],
    mode: str,
) -> _PreparedBody:
    explicit_content_type = _validate_content_type(_string(draft.get("contentType")))
    if mode == "none":
        return _PreparedBody(None, None)
    if mode == "raw":
        return _PreparedBody(_string_or_empty(draft.get("body")).encode(), explicit_content_type)
    if mode == "json":
        return _PreparedBody(
            _string_or_empty(draft.get("body")).encode(),
            explicit_content_type or "application/json",
        )
    if mode == "binary":
        encoded = _string(envelope.get("bodyBase64"))
        if encoded is None:
            raise _bad_request("Binary host execution requires bodyBase64.")
        content_type = explicit_content_type
        raw_binary = draft.get("binary")
        if content_type is None and isinstance(raw_binary, dict):
            content_type = _validate_content_type(_string(raw_binary.get("contentType")))
        try:
            data = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise _bad_request("Binary host execution bodyBase64 is invalid.") from error
        return _PreparedBody(data, content_type or "application/octet-stream")
    if mode == "urlencoded":
        pairs = [
            (_string(entry.get("key")) or "", _string_or_empty(entry.get("value")))
            for entry in _entries(draft.get("urlencoded"))
            if entry.get("enabled") is not False and (_string(entry.get("key")) or "").strip()
        ]
        return _PreparedBody(
            urlencode(pairs).encode(),
            explicit_content_type or "application/x-www-form-urlencoded",
        )
    if mode == "graphql":
        graph = _object(draft.get("graphql"), "GraphQL body must be an object.")
        raw_variables = (_string(graph.get("variables")) or "").strip()
        try:
            variables = json.loads(raw_variables) if raw_variables else {}
        except json.JSONDecodeError as error:
            raise _bad_request("GraphQL variables must be valid JSON.") from error
        payload = json.dumps(
            {"query": _string(graph.get("query")) or "", "variables": variables},
            separators=(",", ":"),
        ).encode()
        return _PreparedBody(payload, explicit_content_type or "application/json")
    if mode == "formdata":
        return _multipart_body(_entries(draft.get("formData")), files)
    raise _unsupported(f"Body mode {mode} is not implemented by the Python host executor.")


def _multipart_body(
    entries: list[dict[str, object]],
    files: dict[int, FlexDocHostExecutionFile],
) -> _PreparedBody:
    boundary = "----flexdoc-" + uuid.uuid4().hex
    chunks: list[bytes] = []
    for index, entry in enumerate(entries):
        if entry.get("enabled") is False:
            continue
        key = _string(entry.get("key"))
        if key is None or not key.strip():
            continue
        chunks.append(f"--{boundary}\r\n".encode())
        quoted_key = _quote_multipart(key)
        if _string(entry.get("type")) == "file":
            file = files.get(index)
            if file is None:
                raise _bad_request(f'File field "{key}" needs an uploaded file part.')
            filename = file.filename or _string(entry.get("fileName")) or "upload.bin"
            content_type = _validate_content_type(
                file.content_type or _string(entry.get("contentType")) or "application/octet-stream"
            )
            assert content_type is not None
            chunks.append(
                f'Content-Disposition: form-data; name="{quoted_key}"; filename="{_quote_multipart(filename)}"\r\n'.encode()
            )
            chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode())
            chunks.append(file.data)
            chunks.append(b"\r\n")
        else:
            chunks.append(
                f'Content-Disposition: form-data; name="{quoted_key}"\r\n\r\n{_string_or_empty(entry.get("value"))}\r\n'.encode()
            )
    chunks.append(f"--{boundary}--\r\n".encode())
    return _PreparedBody(b"".join(chunks), f"multipart/form-data; boundary={boundary}")


def _infer_body_mode(draft: dict[str, object]) -> str:
    mode = _string(draft.get("bodyMode"))
    if mode and mode.strip():
        return mode
    raw_binary = draft.get("binary")
    if isinstance(raw_binary, dict) and _string(raw_binary.get("fileName")):
        return "binary"
    raw_form_data = draft.get("formData")
    if isinstance(raw_form_data, list) and len(raw_form_data) > 0:
        return "formdata"
    raw_urlencoded = draft.get("urlencoded")
    if isinstance(raw_urlencoded, list) and len(raw_urlencoded) > 0:
        return "urlencoded"
    raw_graphql = draft.get("graphql")
    if isinstance(raw_graphql, dict) and (
        _string(raw_graphql.get("query")) or _string(raw_graphql.get("variables"))
    ):
        return "graphql"
    if not _string(draft.get("body")):
        return "none"
    return "json" if "json" in (_string(draft.get("contentType")) or "").lower() else "raw"


def _sanitize_headers(entries: list[dict[str, object]]) -> list[tuple[str, str]]:
    headers: list[tuple[str, str]] = []
    for entry in entries:
        if entry.get("enabled") is False:
            continue
        name = _string(entry.get("key"))
        if name is None or not name.strip():
            continue
        name = name.strip()
        normalized = name.lower()
        if _unsafe_header(normalized):
            continue
        value = _string_or_empty(entry.get("value"))
        if not _HEADER_NAME.fullmatch(name) or "\r" in value or "\n" in value:
            raise _bad_request(f"Invalid host execution request header: {name}")
        headers.append((name, value))
    return headers


def _apply_header_auth(raw_auth: object, headers: list[tuple[str, str]]) -> None:
    if not isinstance(raw_auth, dict):
        return
    auth = raw_auth
    auth_type = _string(auth.get("type"))
    if auth_type is None or auth_type in {"none", "inherit"}:
        return
    if auth_type == "bearer":
        token = _string_or_empty(auth.get("token"))
        if "\r" in token or "\n" in token:
            raise _bad_request("Invalid host execution request header: Authorization")
        if token:
            _set_header(headers, "Authorization", "Bearer " + token)
        return
    if auth_type == "oauth2":
        token = _string_or_empty(auth.get("accessToken"))
        if "\r" in token or "\n" in token:
            raise _bad_request("Invalid host execution request header: Authorization")
        if token:
            _set_header(headers, "Authorization", "Bearer " + token)
        return
    if auth_type == "basic":
        credential = (_string_or_empty(auth.get("username")) + ":" + _string_or_empty(auth.get("password"))).encode()
        _set_header(headers, "Authorization", "Basic " + base64.b64encode(credential).decode())
        return
    if auth_type == "apiKey":
        key = _string(auth.get("key"))
        if key is None or not key.strip():
            raise _bad_request("API key authentication requires a key name.")
        key = key.strip()
        location = _string(auth.get("in")) or "header"
        if location == "header":
            normalized = key.lower()
            if _unsafe_header(normalized):
                raise _bad_request(f"Unsafe host execution request header: {key}")
            value = _string_or_empty(auth.get("value"))
            if not _HEADER_NAME.fullmatch(key) or "\r" in value or "\n" in value:
                raise _bad_request(f"Invalid host execution request header: {key}")
            _set_header(headers, key, value)
        elif location == "query":
            pass
        elif location == "cookie":
            raise _unsupported("Cookie authentication is not implemented by the Python host executor.")
        else:
            raise _bad_request(f"Unsupported API key location: {location}")
        return
    raise _unsupported(f"Authentication type {auth_type} is not implemented by the Python host executor.")


def _apply_query_auth(raw_auth: object, url: str) -> str:
    if not isinstance(raw_auth, dict):
        return url
    if _string(raw_auth.get("type")) != "apiKey" or _string(raw_auth.get("in")) != "query":
        return url
    key = _string(raw_auth.get("key"))
    if key is None or not key.strip():
        raise _bad_request("API key authentication requires a key name.")
    return _append_query(url, [{"key": key, "value": _string_or_empty(raw_auth.get("value"))}])


def _append_query(url: str, entries: list[dict[str, object]]) -> str:
    if not entries:
        return url
    parts = _split_http_url(url)
    query = parts.query
    additions: list[str] = []
    for entry in entries:
        if entry.get("enabled") is False:
            continue
        key = _string(entry.get("key"))
        if key is None or not key.strip():
            continue
        additions.append(
            quote(key, safe="") + "=" + quote(_string_or_empty(entry.get("value")), safe="")
        )
    if not additions:
        return url
    query = query + ("&" if query else "") + "&".join(additions)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _parse_target(value: str) -> str:
    parts = _split_http_url(value)
    if parts.username is not None or parts.password is not None:
        raise _forbidden("Host execution URLs cannot contain embedded credentials.")
    return value


def _split_http_url(value: str):
    try:
        parts = urlsplit(value)
        if parts.scheme.lower() not in {"http", "https"} or parts.hostname is None:
            raise ValueError
        _ = parts.port
        return parts
    except ValueError as error:
        raise _bad_request("Host execution requires an absolute HTTP(S) request URL.") from error


def _normalize_allowed_origin(value: str) -> str:
    parts = _split_http_url(value)
    if parts.username is not None or parts.password is not None:
        raise ValueError("Allowed origins cannot contain embedded credentials.")
    if parts.path not in {"", "/"} or parts.query or parts.fragment:
        raise ValueError("Allowed origins must be exact origins without a path, query, or fragment.")
    return _origin(value)


def _origin(value: str) -> str:
    parts = _split_http_url(value)
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").lower()
    if ":" in host and not host.startswith("["):
        host = "[" + host + "]"
    port = parts.port
    default = port is None or (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    return f"{scheme}://{host}" + ("" if default else f":{port}")


def _authority(parts) -> str:
    host = parts.hostname or ""
    if ":" in host and not host.startswith("["):
        host = "[" + host + "]"
    port = parts.port
    scheme = parts.scheme.lower()
    default = port is None or (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    return host if default else f"{host}:{port}"


def _is_metadata_host(host: str) -> bool:
    normalized = host.strip("[]").lower()
    if normalized in _METADATA_HOSTS or normalized.startswith("fe80:"):
        return True
    try:
        address = ipaddress.ip_address(normalized.split("%", 1)[0])
    except ValueError:
        return False
    mapped = getattr(address, "ipv4_mapped", None)
    return address.is_link_local or (mapped is not None and mapped.is_link_local)


def _unsafe_header(normalized: str) -> bool:
    return (
        normalized in _HOP_BY_HOP
        or normalized in _FORBIDDEN_HEADERS
        or normalized.startswith("proxy-")
        or normalized.startswith("sec-")
    )


def _validate_content_type(value: str | None) -> str | None:
    if value is not None and ("\r" in value or "\n" in value):
        raise _bad_request("Invalid host execution content type.")
    return value


def _entries(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [entry for entry in value if isinstance(entry, dict)]


def _object(value: object, message: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise _bad_request(message)
    return value


def _string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _string_or_empty(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _header(headers: list[tuple[str, str]], name: str) -> str | None:
    lowered = name.lower()
    for key, value in headers:
        if key.lower() == lowered:
            return value
    return None


def _set_header(headers: list[tuple[str, str]], name: str, value: str) -> None:
    _delete_header(headers, name)
    headers.append((name, value))


def _delete_header(headers: list[tuple[str, str]], name: str) -> None:
    lowered = name.lower()
    headers[:] = [(key, value) for key, value in headers if key.lower() != lowered]


def _quote_multipart(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\r", "").replace("\n", "")


def _bad_request(message: str) -> FlexDocHostExecutionError:
    return FlexDocHostExecutionError(400, message)


def _unsupported(message: str) -> FlexDocHostExecutionError:
    return FlexDocHostExecutionError(400, message)


def _forbidden(message: str) -> FlexDocHostExecutionError:
    return FlexDocHostExecutionError(403, message)


def _upstream(message: str) -> FlexDocHostExecutionError:
    return FlexDocHostExecutionError(502, message)
