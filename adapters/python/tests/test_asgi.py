import asyncio
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from flexdoc_adapter import FlexDocASGI, FlexDocConfig


async def request(app, path):
    messages = []
    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}
    async def send(message):
        messages.append(message)
    await app({"type":"http", "path":path, "method":"GET"}, receive, send)
    return messages


class FlexDocASGITest(unittest.TestCase):
    def test_page_and_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "flexdoc.standalone.js").write_text("window.FlexDocStandalone={};")
            Path(tmp, "flexdoc.standalone.css").write_text("body{}")
            app = FlexDocASGI(FlexDocConfig(path="/reference", title="</script><script>alert(1)</script>"), assets_dir=tmp)
            messages = asyncio.run(request(app, "/reference"))
            body = messages[-1]["body"].decode()
            self.assertEqual(messages[0]["status"], 200)
            self.assertIn("/reference/__flexdoc/renderer.js", body)
            self.assertNotIn("</script><script>alert(1)</script>", body)
            messages = asyncio.run(request(app, "/reference/__flexdoc/renderer.js"))
            self.assertEqual(messages[0]["status"], 200)
            self.assertTrue(any(name == b"cache-control" and b"immutable" in value for name, value in messages[0]["headers"]))


if __name__ == "__main__":
    unittest.main()
