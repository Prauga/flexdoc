"""Flask Runtime Intelligence boundary tests. Requires the optional ``flask`` extra."""

import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import setup_flask_flexdoc

FLASK = importlib.util.find_spec("flask") is not None

SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "Pets", "version": "1.0.0"},
    "paths": {
        "/pets": {"get": {"responses": {"200": {"description": "ok"}}}},
        "/pets/{pet_id}": {"get": {"responses": {"200": {"description": "ok"}}}},
        "/retired": {"get": {"responses": {"200": {"description": "ok"}}}},
    },
}


@unittest.skipUnless(FLASK, "flask is not installed")
class FlaskRuntimeIntelligenceTest(unittest.TestCase):
    def _app(self, **kwargs):
        from flask import Flask

        app = Flask(__name__)

        @app.get("/pets")
        def list_pets():
            return {"pets": []}

        @app.get("/pets/<int:pet_id>")
        def read_pet(pet_id):
            return {"id": pet_id}

        @app.post("/pets/<int:pet_id>/adopt")
        def adopt(pet_id):
            return {"id": pet_id}

        setup_flask_flexdoc(app, "/docs", **kwargs)
        return app

    def _snapshot(self, **kwargs):
        response = self._app(runtime_intelligence_spec=SPEC, **kwargs).test_client().get("/docs/__flexdoc/runtime")
        self.assertEqual(response.status_code, 200)
        return json.loads(response.get_data())

    def test_runtime_route_is_absent_unless_a_specification_is_supplied(self):
        response = self._app().test_client().get("/docs/__flexdoc/runtime")

        self.assertEqual(response.status_code, 404)

    def test_reports_live_routes_against_the_documented_specification(self):
        snapshot = self._snapshot()

        self.assertEqual(snapshot["framework"], "flask")
        self.assertTrue(snapshot["discoveryComplete"])
        self.assertIn({"method": "GET", "path": "/pets"}, snapshot["routes"])
        self.assertIn({"method": "GET", "path": "/pets/{pet_id}"}, snapshot["routes"])

    def test_names_both_directions_of_drift(self):
        snapshot = self._snapshot()

        self.assertIn({"method": "POST", "path": "/pets/{pet_id}/adopt"}, snapshot["runtimeOnly"])
        self.assertIn({"method": "GET", "path": "/retired"}, snapshot["documentedOnly"])
        self.assertEqual(snapshot["summary"], {
            "documented": 3,
            "runtime": 3,
            "matched": 2,
            "runtimeOnly": 1,
            "documentedOnly": 1,
        })

    def test_excludes_the_docs_mount_from_discovered_routes(self):
        snapshot = self._snapshot()

        self.assertEqual([route for route in snapshot["routes"] if route["path"].startswith("/docs")], [])

    def test_does_not_report_the_options_and_head_routes_werkzeug_adds_itself(self):
        methods = {route["method"] for route in self._snapshot()["routes"]}

        self.assertNotIn("OPTIONS", methods)
        self.assertNotIn("HEAD", methods)

    def test_accepts_a_callable_specification_so_it_can_change_at_runtime(self):
        calls = []

        def spec():
            calls.append(1)
            return SPEC

        client = self._app(runtime_intelligence_spec=spec).test_client()
        client.get("/docs/__flexdoc/runtime")
        client.get("/docs/__flexdoc/runtime")

        self.assertEqual(len(calls), 2)

    def test_advertises_runtime_intelligence_to_the_renderer(self):
        page = self._app(runtime_intelligence_spec=SPEC).test_client().get("/docs").get_data(as_text=True)

        self.assertIn('"runtimeIntelligence"', page)
        self.assertIn('"framework":"flask"', page)

    def test_rejects_a_non_get_runtime_request(self):
        client = self._app(runtime_intelligence_spec=SPEC).test_client()

        self.assertEqual(client.post("/docs/__flexdoc/runtime").status_code, 405)


if __name__ == "__main__":
    unittest.main()
