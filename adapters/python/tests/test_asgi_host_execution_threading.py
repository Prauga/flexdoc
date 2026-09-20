import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

import prauga_flexdoc.asgi as asgi_module
from prauga_flexdoc import FlexDocASGI, FlexDocConfig


class _Executor:
    capabilities = ()

    def __init__(self):
        self.handle_threads = []

    def handle(self, marker, envelope, files=None):
        self.handle_threads.append(threading.get_ident())
        self.marker = marker
        self.envelope = envelope
        self.files = files or {}
        return SimpleNamespace(status=200, body={"status": 204, "headers": [], "body": ""})


class FlexDocAsgiThreadingTest(unittest.TestCase):
    def test_execute_envelope_parsing_runs_off_event_loop_without_body_copy(self):
        executor = _Executor()
        app = FlexDocASGI(
            FlexDocConfig(path="/docs", try_it_host_execution=True),
            host_execution=executor,
        )
        descriptor = bytearray(json.dumps({"request": {"url": "https://api.example.test/health"}}).encode())
        parser_threads = []
        parser_chunk_identity = []
        original = asgi_module.parse_execute_envelope

        def recording_parser(content_type, chunks):
            parser_threads.append(threading.get_ident())
            parser_chunk_identity.append(chunks[0] is descriptor)
            return original(content_type, chunks)

        async def run_request():
            loop_thread = threading.get_ident()
            received = False
            messages = []

            async def receive():
                nonlocal received
                if received:
                    return {"type": "http.request", "body": b"", "more_body": False}
                received = True
                return {"type": "http.request", "body": descriptor, "more_body": False}

            async def send(message):
                messages.append(message)

            with patch.object(asgi_module, "parse_execute_envelope", recording_parser):
                await app(
                    {
                        "type": "http",
                        "path": "/docs/__flexdoc/execute",
                        "method": "POST",
                        "headers": [
                            (b"x-flexdoc-execute", b"1"),
                            (b"content-type", b"application/json"),
                        ],
                    },
                    receive,
                    send,
                )
            return loop_thread, messages

        loop_thread, messages = asyncio.run(run_request())
        self.assertEqual(messages[0]["status"], 200)
        self.assertEqual(len(parser_threads), 1)
        self.assertNotEqual(parser_threads[0], loop_thread)
        self.assertEqual(parser_chunk_identity, [True])
        self.assertEqual(len(executor.handle_threads), 1)
        self.assertNotEqual(executor.handle_threads[0], loop_thread)
        self.assertEqual(executor.marker, "1")
        self.assertEqual(executor.envelope["request"]["url"], "https://api.example.test/health")

    def test_invalid_execute_marker_handling_runs_off_event_loop(self):
        executor = _Executor()
        app = FlexDocASGI(
            FlexDocConfig(path="/docs", try_it_host_execution=True),
            host_execution=executor,
        )

        async def run_request():
            loop_thread = threading.get_ident()
            messages = []

            async def receive():
                self.fail("invalid-marker handling must not read a request body")

            async def send(message):
                messages.append(message)

            await app(
                {
                    "type": "http",
                    "path": "/docs/__flexdoc/execute",
                    "method": "POST",
                    "headers": [(b"x-flexdoc-execute", b"invalid")],
                },
                receive,
                send,
            )
            return loop_thread, messages

        loop_thread, messages = asyncio.run(run_request())
        self.assertEqual(messages[0]["status"], 200)
        self.assertEqual(len(executor.handle_threads), 1)
        self.assertNotEqual(executor.handle_threads[0], loop_thread)
        self.assertEqual(executor.marker, "invalid")
        self.assertEqual(executor.envelope, {})


if __name__ == "__main__":
    unittest.main()
