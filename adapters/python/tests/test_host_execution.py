import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import FlexDocASGI, FlexDocConfig
from prauga_flexdoc.host_execution import FlexDocHostExecution, FlexDocHostExecutionFile


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def _send(self, status, body=b"", **headers):
        self.send_response(status)
        for name, value in headers.items():
            self.send_header(name.replace("_", "-"), str(value))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/redirect-local"):
            self._send(302, Location="/echo?redirected=1")
            return
        if self.path.startswith("/redirect-cross"):
            self._send(302, Location="http://169.254.169.254/latest/meta-data")
            return
        if self.path.startswith("/trickle"):
            self.send_response(200)
            self.send_header("Content-Length", "5")
            self.end_headers()
            for byte in b"abcde":
                self.wfile.write(bytes([byte]))
                self.wfile.flush()
                time.sleep(0.08)
            return
        if self.path.startswith("/oversized"):
            body = b"x" * (10 * 1024 * 1024 + 1)
            self._send(200, body)
            return
        self._echo()

    def do_POST(self):
        self._echo()

    def _echo(self):
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else b""
        payload = {
            "method": self.command,
            "path": self.path,
            "authorization": self.headers.get("Authorization"),
            "origin": self.headers.get("Origin"),
            "contentType": self.headers.get("Content-Type"),
            "xTest": self.headers.get("X-Test"),
            "body": body.decode("utf-8", errors="replace"),
        }
        encoded = json.dumps(payload, separators=(",", ":")).encode()
        self._send(200, encoded, Content_Type="application/json")


class FlexDocHostExecutionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def executor(self):
        return FlexDocHostExecution([self.origin])

    def test_executes_canonical_request_and_strips_unsafe_headers(self):
        result = self.executor().handle("1", {"request": {
            "method": "POST",
            "url": self.origin + "/echo",
            "query": [{"key": "page", "value": "2"}],
            "headers": [
                {"key": "X-Test", "value": "python"},
                {"key": "Origin", "value": "https://evil.example"},
            ],
            "bodyMode": "json",
            "body": "{\"ok\":true}",
            "auth": {"type": "bearer", "token": "secret"},
        }})
        self.assertEqual(result.status, 200)
        target = json.loads(result.body["body"])
        self.assertEqual(target["method"], "POST")
        self.assertEqual(target["path"], "/echo?page=2")
        self.assertEqual(target["authorization"], "Bearer secret")
        self.assertEqual(target["xTest"], "python")
        self.assertIsNone(target["origin"])
        self.assertEqual(target["body"], '{"ok":true}')

    def test_preserves_existing_percent_encoding(self):
        result = self.executor().handle("1", {"request": {
            "url": self.origin + "/echo/a%2Fb?existing=a%20b",
            "query": [{"key": "extra", "value": "x y"}],
        }})
        self.assertEqual(result.status, 200)
        target = json.loads(result.body["body"])
        self.assertEqual(target["path"], "/echo/a%2Fb?existing=a%20b&extra=x%20y")

    def test_reapplies_query_api_key_after_same_origin_redirect(self):
        result = self.executor().handle("1", {"request": {
            "url": self.origin + "/redirect-local",
            "auth": {"type": "apiKey", "key": "token", "value": "secret", "in": "query"},
        }})
        self.assertEqual(result.status, 200)
        target = json.loads(result.body["body"])
        self.assertEqual(target["path"], "/echo?redirected=1&token=secret")

    def test_rejects_cross_origin_redirect(self):
        result = self.executor().handle("1", {"request": {"url": self.origin + "/redirect-cross"}})
        self.assertEqual(result.status, 403)
        self.assertIn("cross-origin", str(result.body["error"]))

    def test_blocks_metadata_even_when_allowlisted(self):
        executor = FlexDocHostExecution(["http://169.254.169.254"])
        result = executor.handle("1", {"request": {"url": "http://169.254.169.254/latest"}})
        self.assertEqual(result.status, 403)
        self.assertIn("metadata", str(result.body["error"]))

    def test_requires_execution_marker(self):
        result = self.executor().handle(None, {"request": {"url": self.origin + "/echo"}})
        self.assertEqual(result.status, 403)
        self.assertEqual(result.body["error"], "Missing X-FlexDoc-Execute header.")

    def test_rejects_unadvertised_host_only_auth(self):
        result = self.executor().handle("1", {"request": {
            "url": self.origin + "/echo",
            "auth": {"type": "digest", "username": "alice", "password": "secret"},
        }})
        self.assertEqual(result.status, 400)
        self.assertIn("not implemented", str(result.body["error"]))

    def test_executes_canonical_multipart_file_envelope(self):
        result = self.executor().handle(
            "1",
            {"request": {
                "method": "POST",
                "url": self.origin + "/echo",
                "headers": [{"key": "Content-Type", "value": "multipart/form-data; boundary=stale"}],
                "bodyMode": "formdata",
                "formData": [
                    {"key": "note", "value": "hello", "type": "text"},
                    {"key": "upload", "type": "file", "fileName": "draft.txt", "contentType": "text/plain"},
                ],
            }},
            {1: FlexDocHostExecutionFile("actual.txt", "text/plain", b"FILE-BYTES")},
        )
        self.assertEqual(result.status, 200)
        target = json.loads(result.body["body"])
        self.assertTrue(target["contentType"].startswith("multipart/form-data; boundary=----flexdoc-"))
        self.assertNotIn("boundary=stale", target["contentType"])
        self.assertIn('name="note"', target["body"])
        self.assertIn("hello", target["body"])
        self.assertIn('name="upload"; filename="actual.txt"', target["body"])
        self.assertIn("FILE-BYTES", target["body"])

    def test_full_response_deadline_covers_slow_trickle_body(self):
        started = time.perf_counter()
        result = self.executor().handle("1", {
            "timeoutMs": 150,
            "request": {"url": self.origin + "/trickle"},
        })
        elapsed = time.perf_counter() - started
        self.assertEqual(result.status, 502)
        self.assertIn("timed out", str(result.body["error"]).lower())
        self.assertLess(elapsed, 0.35)

    def test_response_body_is_bounded_to_ten_mib(self):
        result = self.executor().handle("1", {"request": {"url": self.origin + "/oversized"}})
        self.assertEqual(result.status, 502)
        self.assertIn("10 MiB", str(result.body["error"]))

    def test_asgi_execute_route_is_real_and_no_store(self):
        app = FlexDocASGI(
            FlexDocConfig(path="/reference", try_it_host_execution=True),
            host_execution=self.executor(),
        )
        descriptor = json.dumps({"request": {"url": self.origin + "/echo"}}).encode()
        messages = asyncio.run(_asgi_request(
            app,
            "/reference/__flexdoc/execute",
            descriptor,
            [(b"x-flexdoc-execute", b"1"), (b"content-type", b"application/json")],
        ))
        self.assertEqual(messages[0]["status"], 200)
        self.assertIn((b"cache-control", b"no-store"), messages[0]["headers"])
        payload = json.loads(messages[1]["body"])
        self.assertEqual(payload["status"], 200)


async def _asgi_request(app, path, body, headers):
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

    await app({"type": "http", "path": path, "method": "POST", "headers": headers}, receive, send)
    return messages


if __name__ == "__main__":
    unittest.main()
