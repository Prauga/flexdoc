import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import FlexDocConfig, FlexDocHostExecution, FlexDocWSGI
from prauga_flexdoc.wsgi import MAX_EXECUTION_REQUEST_BYTES


class _Executor:
    capabilities = ()

    def __init__(self):
        self.calls = []

    def handle(self, marker, envelope, files=None):
        self.calls.append((marker, envelope, files or {}))
        return SimpleNamespace(status=200, body={"status": 204, "headers": [], "body": ""})


class _Recorder:
    def __init__(self):
        self.status = None
        self.headers = None

    def __call__(self, status, headers):
        self.status = status
        self.headers = dict(headers)


class _BlockingStream(io.BytesIO):
    """A stream that fails the test if read past the declared request length."""

    def __init__(self, data, limit):
        super().__init__(data)
        self.limit = limit
        self.consumed = 0

    def read(self, size=-1):
        if self.consumed >= self.limit:
            raise AssertionError("read past the declared Content-Length would block a real WSGI server")
        chunk = super().read(size)
        self.consumed += len(chunk)
        return chunk


def _environ(body=b"", *, method="POST", marker="1", content_type="application/json", declared=True, stream=None, **extra):
    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": "/docs/__flexdoc/execute",
        "CONTENT_TYPE": content_type,
        "wsgi.input": stream if stream is not None else io.BytesIO(body),
    }
    if declared:
        environ["CONTENT_LENGTH"] = str(len(body))
    if marker is not None:
        environ["HTTP_X_FLEXDOC_EXECUTE"] = marker
    environ.update(extra)
    return environ


def _app(executor):
    return FlexDocWSGI(FlexDocConfig(path="/docs", try_it_host_execution=True), host_execution=executor)


def _call(app, environ):
    recorder = _Recorder()
    body = b"".join(app(environ, recorder))
    return recorder, json.loads(body) if body else None


class FlexDocWsgiHostExecutionTest(unittest.TestCase):
    def test_serves_a_parsed_json_envelope_to_the_executor(self):
        executor = _Executor()
        body = json.dumps({"request": {"url": "https://api.example.test/health"}}).encode()
        recorder, payload = _call(_app(executor), _environ(body))

        self.assertEqual(recorder.status, "200 OK")
        self.assertEqual(recorder.headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(recorder.headers["Cache-Control"], "no-store")
        self.assertEqual(payload["status"], 204)
        marker, envelope, files = executor.calls[0]
        self.assertEqual(marker, "1")
        self.assertEqual(envelope["request"]["url"], "https://api.example.test/health")
        self.assertEqual(files, {})

    def test_parses_a_multipart_envelope_with_form_files(self):
        executor = _Executor()
        descriptor = json.dumps({"request": {"url": "https://api.example.test/upload", "method": "POST"}})
        body = (
            b"--b\r\nContent-Disposition: form-data; name=\"descriptor\"\r\n\r\n" + descriptor.encode() + b"\r\n"
            b"--b\r\nContent-Disposition: form-data; name=\"formData[0]\"; filename=\"a.txt\"\r\n"
            b"Content-Type: text/plain\r\n\r\nhello\r\n--b--\r\n"
        )
        recorder, _ = _call(_app(executor), _environ(body, content_type="multipart/form-data; boundary=b"))

        self.assertEqual(recorder.status, "200 OK")
        _, envelope, files = executor.calls[0]
        self.assertEqual(envelope["request"]["url"], "https://api.example.test/upload")
        self.assertEqual(files[0].data, b"hello")
        self.assertEqual(files[0].filename, "a.txt")

    def test_reads_no_more_than_the_declared_length(self):
        executor = _Executor()
        body = json.dumps({"request": {"url": "https://api.example.test/health"}}).encode()
        stream = _BlockingStream(body + b"trailing bytes a real server would not deliver", len(body))
        recorder, _ = _call(_app(executor), _environ(body, stream=stream, declared=False, CONTENT_LENGTH=str(len(body))))

        self.assertEqual(recorder.status, "200 OK")
        self.assertEqual(stream.consumed, len(body))

    def test_rejects_a_body_with_no_length_and_no_terminated_stream(self):
        executor = _Executor()
        recorder, payload = _call(_app(executor), _environ(b"{}", declared=False))

        self.assertEqual(recorder.status, "411 Length Required")
        self.assertEqual(payload, {"error": "Host execution requires a Content-Length."})
        self.assertEqual(executor.calls, [])

    def test_reads_a_chunked_body_when_the_server_terminates_the_stream(self):
        executor = _Executor()
        body = json.dumps({"request": {"url": "https://api.example.test/health"}}).encode()
        environ = _environ(
            body,
            declared=False,
            HTTP_TRANSFER_ENCODING="chunked",
            **{"wsgi.input_terminated": True},
        )
        recorder, _ = _call(_app(executor), environ)

        self.assertEqual(recorder.status, "200 OK")
        self.assertEqual(executor.calls[0][1]["request"]["url"], "https://api.example.test/health")

    def test_rejects_a_declared_length_over_the_safety_limit(self):
        executor = _Executor()
        environ = _environ(b"{}", declared=False, CONTENT_LENGTH=str(MAX_EXECUTION_REQUEST_BYTES + 1))
        recorder, payload = _call(_app(executor), environ)

        self.assertEqual(recorder.status, "400 Bad Request")
        self.assertEqual(payload, {"error": "Host execution request exceeded the 32 MiB safety limit."})
        self.assertEqual(executor.calls, [])

    def test_rejects_an_unsupported_media_type(self):
        executor = _Executor()
        recorder, payload = _call(_app(executor), _environ(b"url=x", content_type="application/x-www-form-urlencoded"))

        self.assertEqual(recorder.status, "400 Bad Request")
        self.assertEqual(payload, {"error": "Host execution requires application/json or multipart/form-data."})
        self.assertEqual(executor.calls, [])

    def test_rejects_a_non_post_method(self):
        executor = _Executor()
        recorder, payload = _call(_app(executor), _environ(method="GET"))

        self.assertEqual(recorder.status, "405 Method Not Allowed")
        self.assertEqual(payload, {"error": "Method not allowed."})
        self.assertEqual(executor.calls, [])

    def test_hands_a_missing_marker_to_the_executor_without_reading_a_body(self):
        executor = _Executor()
        stream = _BlockingStream(b"{}", 0)
        recorder, _ = _call(_app(executor), _environ(b"{}", marker=None, stream=stream, declared=False))

        self.assertEqual(recorder.status, "200 OK")
        self.assertEqual(executor.calls, [(None, {}, {})])
        self.assertEqual(stream.consumed, 0)

    def test_a_real_executor_rejects_a_missing_marker_with_403(self):
        app = _app(FlexDocHostExecution(["https://api.example.test"]))
        recorder, payload = _call(app, _environ(b"{}", marker=None))

        self.assertEqual(recorder.status, "403 Forbidden")
        self.assertEqual(payload, {"error": "Missing X-FlexDoc-Execute header."})

    def test_execute_route_is_absent_without_a_configured_executor(self):
        app = FlexDocWSGI(FlexDocConfig(path="/docs", try_it_host_execution=True))
        recorder = _Recorder()
        app(_environ(b"{}"), recorder)

        self.assertEqual(recorder.status, "404 Not Found")

    def test_renderer_advertises_host_execution_only_when_an_executor_is_mounted(self):
        with_executor = _app(_Executor())
        without = FlexDocWSGI(FlexDocConfig(path="/docs", try_it_host_execution=True))

        self.assertIn('"available":true', with_executor.host.route("/docs").body.decode())
        self.assertIn('"available":false', without.host.route("/docs").body.decode())


if __name__ == "__main__":
    unittest.main()
