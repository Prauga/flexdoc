import asyncio
import json
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from prauga_flexdoc import FlexDocASGI, FlexDocConfig


async def request(app, path):
    messages = []
    async def receive(): return {"type": "http.request", "body": b"", "more_body": False}
    async def send(message): messages.append(message)
    await app({"type":"http", "path":path, "method":"GET"}, receive, send)
    return messages


def options_from_html(body: str):
    prefix = "window.__FLEXDOC_OPTIONS__="
    start = body.index(prefix) + len(prefix)
    end = body.index(";</script>", start)
    return json.loads(body[start:end])


class FlexDocASGITest(unittest.TestCase):
    def test_page_and_bundled_assets(self):
        app = FlexDocASGI(FlexDocConfig(path="/reference", spec_url="/openapi.json?x=</script>", title="</script><script>alert(1)</script>"))
        messages = asyncio.run(request(app, "/reference"))
        body = messages[-1]["body"].decode()
        self.assertEqual(messages[0]["status"], 200)
        self.assertIn("/reference/__flexdoc/renderer.js?v=", body)
        self.assertIn("/reference/__flexdoc/renderer.css?v=", body)
        self.assertNotIn("</script><script>alert(1)</script>", body)
        self.assertNotIn('"/openapi.json?x=</script>"', body)
        messages = asyncio.run(request(app, "/reference/__flexdoc/renderer.js"))
        self.assertEqual(messages[0]["status"], 200)
        self.assertGreater(len(messages[-1]["body"]), 0)
        self.assertTrue(any(name == b"cache-control" and b"immutable" in value for name, value in messages[0]["headers"]))

    def test_optional_renderer_fields_are_omitted(self):
        app = FlexDocASGI(FlexDocConfig(path="/reference", try_it_enabled=True))
        messages = asyncio.run(request(app, "/reference"))
        options = options_from_html(messages[-1]["body"].decode())
        self.assertNotIn("expand", options)
        self.assertEqual(options["tryIt"], {"enabled": True})

    def test_renderer_options_support_preset_and_section_list(self):
        for expand in ("documentation", ["parameters", "tryIt"]):
            with self.subTest(expand=expand):
                app = FlexDocASGI(FlexDocConfig(
                    path="/reference",
                    expand=expand,
                    try_it_enabled=True,
                    try_it_default_server="https://gateway.example.test",
                    try_it_credentials="include",
                    try_it_api_client_persistence_key=False,
                ))
                messages = asyncio.run(request(app, "/reference"))
                options = options_from_html(messages[-1]["body"].decode())
                self.assertEqual(options["expand"], expand)
                self.assertEqual(options["tryIt"], {
                    "enabled": True,
                    "defaultServer": "https://gateway.example.test",
                    "credentials": "include",
                    "apiClientPersistenceKey": False,
                })


if __name__ == "__main__": unittest.main()
