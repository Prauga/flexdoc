import asyncio
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

class FlexDocASGITest(unittest.TestCase):
    def test_page_and_bundled_assets(self):
        app = FlexDocASGI(FlexDocConfig(path="/reference", title="</script><script>alert(1)</script>"))
        messages = asyncio.run(request(app, "/reference"))
        body = messages[-1]["body"].decode()
        self.assertEqual(messages[0]["status"], 200)
        self.assertIn("/reference/__flexdoc/renderer.js", body)
        self.assertNotIn("</script><script>alert(1)</script>", body)
        messages = asyncio.run(request(app, "/reference/__flexdoc/renderer.js"))
        self.assertEqual(messages[0]["status"], 200)
        self.assertGreater(len(messages[-1]["body"]), 0)
        self.assertTrue(any(name == b"cache-control" and b"immutable" in value for name, value in messages[0]["headers"]))

if __name__ == "__main__": unittest.main()
