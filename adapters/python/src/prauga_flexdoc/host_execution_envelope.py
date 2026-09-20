from __future__ import annotations

from email import policy
from email.parser import BytesParser
import json
import re

from .host_execution import FlexDocHostExecutionFile


MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024
_FILE_PART = re.compile(r"^formData\[(\d+)\]$")


def parse_execute_envelope(
    content_type: str,
    chunks: list[bytes | bytearray],
) -> tuple[dict[str, object], dict[int, FlexDocHostExecutionFile]]:
    """Join and parse an execute envelope. Transport-neutral and safe to call off the event loop."""
    if "\r" in content_type or "\n" in content_type:
        raise ValueError("Host execution Content-Type is invalid.")
    body = b"".join(chunks)
    media_type = content_type.split(";", 1)[0].strip().lower()
    if media_type == "application/json":
        return parse_json_envelope(body), {}
    if media_type == "multipart/form-data":
        return _parse_multipart_envelope(content_type, body)
    raise ValueError("Host execution requires application/json or multipart/form-data.")


def parse_json_envelope(body: bytes) -> dict[str, object]:
    """Decode a JSON execute envelope, rejecting anything that is not a UTF-8 JSON object."""
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Host execution body must be valid UTF-8 JSON.") from error
    if not isinstance(payload, dict):
        raise ValueError("Host execution body must be a JSON object.")
    return payload


def validate_declared_length(declared: str | None) -> int | None:
    """Validate a declared Content-Length against the shared 32 MiB execute ceiling."""
    if not declared:
        return None
    try:
        parsed = int(declared)
    except ValueError as error:
        raise ValueError("Host execution request Content-Length is invalid.") from error
    if parsed < 0:
        raise ValueError("Host execution request Content-Length is invalid.")
    if parsed > MAX_EXECUTION_REQUEST_BYTES:
        raise ValueError("Host execution request exceeded the 32 MiB safety limit.")
    return parsed


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
    return parse_json_envelope(descriptor), files
