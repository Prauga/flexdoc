import unittest

from prauga_flexdoc.runtime_intelligence import build_fastapi_runtime_snapshot, discover_fastapi_routes, normalize_runtime_path


class FakeRoute:
    def __init__(self, path, methods):
        self.path = path
        self.methods = methods


class FakeMount:
    def __init__(self, path, routes):
        self.path = path
        self.methods = None
        self.routes = routes


class WebSocketRoute:
    def __init__(self, path):
        self.path = path
        self.methods = None
        self.routes = None


class FakeFastAPI:
    openapi_url = "/openapi.json"
    docs_url = None
    redoc_url = None
    swagger_ui_oauth2_redirect_url = None

    def __init__(self, routes):
        self.routes = routes

    def openapi(self):
        return {
            "paths": {
                "/orders/{order_id}": {"get": {}},
                "/files/{file_path}": {"get": {}},
                "/mounted/items/{item_id}": {"get": {}},
                "/missing": {"post": {}},
            }
        }


class RuntimeIntelligenceTest(unittest.TestCase):
    def test_normalizes_starlette_path_converters(self):
        self.assertEqual(normalize_runtime_path("/files/{file_path:path}/"), "/files/{file_path}")

    def test_builds_fastapi_presence_drift_from_live_routes(self):
        app = FakeFastAPI([
            FakeRoute("/openapi.json", {"GET", "HEAD"}),
            FakeRoute("/orders/{order_id}", {"GET"}),
            FakeRoute("/files/{file_path:path}", {"GET"}),
            FakeRoute("/internal", {"POST"}),
            FakeMount("/mounted", [FakeRoute("/items/{item_id}", {"GET", "HEAD"})]),
            FakeMount("/reference", []),
            WebSocketRoute("/events"),
        ])

        snapshot = build_fastapi_runtime_snapshot(
            app,
            {"scheme": "https", "headers": [(b"host", b"api.example.test")]},
            "/reference",
        )

        self.assertEqual(snapshot["framework"], "fastapi")
        self.assertEqual(snapshot["runtime"]["name"], "python")
        self.assertEqual(snapshot["serverOrigin"], "https://api.example.test")
        self.assertTrue(snapshot["discoveryComplete"])
        self.assertEqual(snapshot["runtimeOnly"], [{"method": "POST", "path": "/internal"}])
        self.assertEqual(snapshot["documentedOnly"], [{"method": "POST", "path": "/missing"}])
        self.assertEqual(snapshot["summary"], {
            "documented": 4,
            "runtime": 4,
            "matched": 3,
            "runtimeOnly": 1,
            "documentedOnly": 1,
        })
        self.assertNotIn({"method": "HEAD", "path": "/mounted/items/{item_id}"}, snapshot["routes"])

    def test_marks_opaque_mounts_partial(self):
        app = FakeFastAPI([FakeMount("/opaque", [])])
        discovery = discover_fastapi_routes(app)
        self.assertFalse(discovery["complete"])
        self.assertEqual(discovery["routes"], [])


if __name__ == "__main__":
    unittest.main()
