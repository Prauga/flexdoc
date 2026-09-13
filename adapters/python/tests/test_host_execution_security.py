import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import FlexDocASGI, FlexDocConfig
from prauga_flexdoc.host_execution import FlexDocHostExecution, FlexDocHostExecutionFile


class _PinnedHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def do_GET(self):
        body = json.dumps({"host": self.headers.get("Host")}, separators=(",", ":")).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class FlexDocHostExecutionSecurityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _PinnedHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_dns_resolution_is_pinned_to_validated_address_set(self):
        hostname = "pin.flexdoc.test"
        origin = f"http://{hostname}:{self.port}"
        calls = 0

        def resolve(host, port, *, type=0):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise socket.gaierror("unexpected second DNS resolution")
            self.assertEqual(host, hostname)
            self.assertEqual(port, self.port)
            self.assertEqual(type, socket.SOCK_STREAM)
            return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", port))]

        with patch("prauga_flexdoc.host_execution.socket.getaddrinfo", side_effect=resolve):
            result = FlexDocHostExecution([origin]).handle("1", {"request": {"url": origin + "/echo"}})

        self.assertEqual(result.status, 200)
        self.assertEqual(calls, 1)
        echoed = json.loads(result.body["body"])
        self.assertEqual(echoed["host"], f"{hostname}:{self.port}")

    def test_rejects_unsafe_api_key_header_before_transport(self):
        executor = FlexDocHostExecution(["https://api.example.test"])
        result = executor.handle("1", {"request": {
            "url": "https://api.example.test/resource",
            "auth": {"type": "apiKey", "in": "header", "key": "Host", "value": "evil.example"},
        }})
        self.assertEqual(result.status, 400)
        self.assertIn("Unsafe host execution request header", str(result.body["error"]))

    def test_rejects_crlf_in_auth_derived_headers_before_transport(self):
        executor = FlexDocHostExecution(["https://api.example.test"])
        api_key = executor.handle("1", {"request": {
            "url": "https://api.example.test/resource",
            "auth": {"type": "apiKey", "in": "header", "key": "X-Api-Key", "value": "secret\r\nX-Evil: yes"},
        }})
        bearer = executor.handle("1", {"request": {
            "url": "https://api.example.test/resource",
            "auth": {"type": "bearer", "token": "secret\r\nX-Evil: yes"},
        }})
        self.assertEqual(api_key.status, 400)
        self.assertEqual(bearer.status, 400)
        self.assertIn("Invalid host execution request header", str(api_key.body["error"]))
        self.assertIn("Invalid host execution request header", str(bearer.body["error"]))

    def test_rejects_derived_content_type_injection_before_transport(self):
        executor = FlexDocHostExecution(["https://api.example.test"])
        direct = executor.handle("1", {"request": {
            "method": "POST",
            "url": "https://api.example.test/resource",
            "bodyMode": "raw",
            "body": "payload",
            "contentType": "text/plain\r\nX-Evil: yes",
        }})
        multipart = executor.handle(
            "1",
            {"request": {
                "method": "POST",
                "url": "https://api.example.test/upload",
                "bodyMode": "formdata",
                "formData": [{"key": "upload", "type": "file"}],
            }},
            {0: FlexDocHostExecutionFile("payload.txt", "text/plain\r\nX-Evil: yes", b"payload")},
        )
        self.assertEqual(direct.status, 400)
        self.assertEqual(multipart.status, 400)
        self.assertIn("Invalid host execution content type", str(direct.body["error"]))
        self.assertIn("Invalid host execution content type", str(multipart.body["error"]))

    def test_asgi_rejects_negative_content_length_and_noncanonical_json_media_type(self):
        executor = FlexDocHostExecution(["https://api.example.test"])
        app = FlexDocASGI(
            FlexDocConfig(path="/reference", try_it_host_execution=True),
            host_execution=executor,
        )
        descriptor = json.dumps({"request": {"url": "https://api.example.test/resource"}}).encode()

        negative = asyncio.run(_asgi_request(
            app,
            descriptor,
            [(b"x-flexdoc-execute", b"1"), (b"content-type", b"application/json"), (b"content-length", b"-1")],
        ))
        wrong_media_type = asyncio.run(_asgi_request(
            app,
            descriptor,
            [(b"x-flexdoc-execute", b"1"), (b"content-type", b"application/jsonx")],
        ))

        self.assertEqual(negative[0]["status"], 400)
        self.assertEqual(wrong_media_type[0]["status"], 400)


async def _asgi_request(app, body, headers):
    messages = []
    received = False

    async def receive():
        nonlocal received
        if received:
            return {"type": "http.request", "body": b"", "more_body": False}
        received = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    await app(
        {"type": "http", "path": "/reference/__flexdoc/execute", "method": "POST", "headers": headers},
        receive,
        send,
    )
    return messages


if __name__ == "__main__":
    unittest.main()
