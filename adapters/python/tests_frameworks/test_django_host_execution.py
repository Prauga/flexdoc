"""Django host-execution boundary tests, including CSRF defaults. Requires the ``django`` extra."""

import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

DJANGO = importlib.util.find_spec("django") is not None

if DJANGO:
    import django
    from django.conf import settings

    if not settings.configured:
        settings.configure(
            DEBUG=False,
            SECRET_KEY="flexdoc-test-secret",
            ALLOWED_HOSTS=["testserver"],
            ROOT_URLCONF="flexdoc_test_urls_default",
            DATABASES={},
            MIDDLEWARE=["django.middleware.csrf.CsrfViewMiddleware"],
            USE_TZ=True,
        )
        django.setup()


def _urlconf(name, **kwargs):
    """Register a urlconf module exposing FlexDoc patterns plus a CSRF-token endpoint."""
    from django.http import HttpResponse
    from django.middleware.csrf import get_token
    from django.urls import path

    from prauga_flexdoc import django_urlpatterns

    module = types.ModuleType(name)
    module.urlpatterns = django_urlpatterns(
        "/docs",
        **kwargs,
    ) + [path("csrf", lambda request: HttpResponse(get_token(request)))]
    sys.modules[name] = module
    return name


_EXECUTE = "/docs/__flexdoc/execute"
_ENVELOPE = json.dumps({"request": {"url": "https://api.example.test/health"}})


@unittest.skipUnless(DJANGO, "django is not installed")
class DjangoHostExecutionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.enforced = _urlconf(
            "flexdoc_test_urls_default",
            try_it_host_execution=True,
            try_it_host_execution_allowed_origins=["https://api.example.test"],
        )
        cls.exempt = _urlconf(
            "flexdoc_test_urls_exempt",
            try_it_host_execution=True,
            try_it_host_execution_allowed_origins=["https://api.example.test"],
            try_it_host_execution_csrf_exempt=True,
        )
        cls.renderer_only = _urlconf("flexdoc_test_urls_renderer_only")

    def _client(self, urlconf):
        from django.test import Client
        from django.test.utils import override_settings

        context = override_settings(ROOT_URLCONF=urlconf)
        context.enable()
        self.addCleanup(context.disable)
        return Client(enforce_csrf_checks=True)

    def _post(self, client, *, content_type="application/json", marker="1", headers=None):
        sent = dict(headers or {})
        if marker is not None:
            sent.setdefault("X-FlexDoc-Execute", marker)
        return client.post(_EXECUTE, data=_ENVELOPE, content_type=content_type, headers=sent)

    def test_csrf_is_enforced_by_default(self):
        client = self._client(self.enforced)
        response = self._post(client)

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("application/json", response.headers.get("Content-Type", ""))

    def test_a_header_csrf_token_satisfies_the_default(self):
        client = self._client(self.enforced)
        token = client.get("/csrf").content.decode()
        response = self._post(
            client,
            content_type="application/x-www-form-urlencoded",
            headers={"X-CSRFToken": token},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "Host execution requires application/json or multipart/form-data."},
        )

    def test_explicit_exemption_bypasses_csrf(self):
        client = self._client(self.exempt)
        response = self._post(client, content_type="application/x-www-form-urlencoded")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "Host execution requires application/json or multipart/form-data."},
        )

    def test_exemption_requires_host_execution(self):
        from prauga_flexdoc import django_urlpatterns

        with self.assertRaises(ValueError) as raised:
            django_urlpatterns("/docs", try_it_host_execution_csrf_exempt=True)

        self.assertIn("requires try_it_host_execution=True", str(raised.exception))

    def test_host_execution_requires_allowed_origins(self):
        from prauga_flexdoc import django_urlpatterns

        with self.assertRaises(ValueError) as raised:
            django_urlpatterns("/docs", try_it_host_execution=True)

        self.assertIn("at least one exact origin", str(raised.exception))

    def test_missing_marker_is_rejected_with_403_json(self):
        client = self._client(self.exempt)
        response = self._post(client, marker=None)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "Missing X-FlexDoc-Execute header."})
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_disallowed_origin_is_rejected(self):
        client = self._client(self.exempt)
        response = client.post(
            _EXECUTE,
            data=json.dumps({"request": {"url": "https://internal.example.test/secrets"}}),
            content_type="application/json",
            headers={"X-FlexDoc-Execute": "1"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("error", response.json())

    def test_execute_route_accepts_only_post(self):
        client = self._client(self.exempt)
        response = client.get(_EXECUTE, headers={"X-FlexDoc-Execute": "1"})

        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": "Method not allowed."})

    def test_renderer_only_mount_has_no_execute_route(self):
        client = self._client(self.renderer_only)
        response = self._post(client)

        self.assertEqual(response.status_code, 404)

    def test_renderer_advertises_host_execution_when_enabled(self):
        client = self._client(self.enforced)
        page = client.get("/docs")

        self.assertEqual(page.status_code, 200)
        self.assertIn('"available":true', page.content.decode())


if __name__ == "__main__":
    unittest.main()
