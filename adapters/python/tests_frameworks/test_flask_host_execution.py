"""Flask host-execution boundary tests. Requires the optional ``flask`` extra."""

import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import setup_flask_flexdoc

FLASK = importlib.util.find_spec("flask") is not None


@unittest.skipUnless(FLASK, "flask is not installed")
class FlaskHostExecutionTest(unittest.TestCase):
    def _app(self, **kwargs):
        from flask import Flask

        app = Flask(__name__)
        host = setup_flask_flexdoc(
            app,
            "/docs",
            try_it_host_execution=True,
            try_it_host_execution_allowed_origins=["https://api.example.test"],
            **kwargs,
        )
        return app, host

    def test_renderer_advertises_host_execution(self):
        app, _ = self._app()
        page = app.test_client().get("/docs")

        self.assertEqual(page.status_code, 200)
        self.assertIn('"available":true', page.get_data(as_text=True))

    def test_execute_requires_allowed_origins(self):
        from flask import Flask

        with self.assertRaises(ValueError) as raised:
            setup_flask_flexdoc(Flask(__name__), "/docs", try_it_host_execution=True)

        self.assertIn("at least one exact origin", str(raised.exception))

    def test_execute_rejects_a_missing_marker(self):
        app, _ = self._app()
        response = app.test_client().post(
            "/docs/__flexdoc/execute",
            data=json.dumps({"request": {"url": "https://api.example.test/health"}}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json(), {"error": "Missing X-FlexDoc-Execute header."})
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_execute_rejects_a_disallowed_origin(self):
        app, _ = self._app()
        response = app.test_client().post(
            "/docs/__flexdoc/execute",
            data=json.dumps({"request": {"url": "https://internal.example.test/secrets"}}),
            content_type="application/json",
            headers={"X-FlexDoc-Execute": "1"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("error", response.get_json())

    def test_execute_rejects_an_unsupported_media_type(self):
        app, _ = self._app()
        response = app.test_client().post(
            "/docs/__flexdoc/execute",
            data="url=x",
            content_type="application/x-www-form-urlencoded",
            headers={"X-FlexDoc-Execute": "1"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Host execution requires application/json or multipart/form-data."},
        )

    def test_execute_route_accepts_only_post(self):
        app, _ = self._app()
        response = app.test_client().get("/docs/__flexdoc/execute", headers={"X-FlexDoc-Execute": "1"})

        self.assertEqual(response.status_code, 405)

    def test_execute_route_is_absent_when_host_execution_is_disabled(self):
        from flask import Flask

        app = Flask(__name__)
        setup_flask_flexdoc(app, "/docs")
        response = app.test_client().post("/docs/__flexdoc/execute", headers={"X-FlexDoc-Execute": "1"})

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
