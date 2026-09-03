import unittest

from prauga_flexdoc import FlexDocConfig, FlexDocWSGI


class FlexDocWSGITest(unittest.TestCase):
    def request(self, app, path):
        captured = {}

        def start_response(status, headers):
            captured["status"] = status
            captured["headers"] = dict(headers)

        body = b"".join(app({"PATH_INFO": path, "REQUEST_METHOD": "GET"}, start_response))
        return captured, body

    def test_docs_and_assets(self):
        app = FlexDocWSGI(FlexDocConfig(path="/reference", spec_url="/openapi.json", title="WSGI API"))
        response, body = self.request(app, "/reference")
        self.assertTrue(response["status"].startswith("200"))
        self.assertEqual(response["headers"]["Cache-Control"], "no-cache")
        self.assertIn(b"WSGI API", body)
        self.assertIn(b'window.__FLEXDOC_SPEC_URL__="/openapi.json"', body)

        asset_response, asset = self.request(app, "/reference/__flexdoc/renderer.js")
        self.assertTrue(asset_response["status"].startswith("200"))
        self.assertIn("immutable", asset_response["headers"]["Cache-Control"])
        self.assertGreater(len(asset), 1000)

    def test_unknown_path_is_404(self):
        app = FlexDocWSGI()
        response, body = self.request(app, "/elsewhere")
        self.assertTrue(response["status"].startswith("404"))
        self.assertEqual(body, b"Not Found")


if __name__ == "__main__":
    unittest.main()
