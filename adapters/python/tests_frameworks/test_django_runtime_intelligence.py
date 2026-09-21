"""Django Runtime Intelligence boundary tests, including what Django cannot report. Requires the optional ``django`` extra."""

import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import django_urlpatterns

DJANGO = importlib.util.find_spec("django") is not None

SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "Pets", "version": "1.0.0"},
    "paths": {
        "/pets": {
            "get": {"responses": {"200": {"description": "ok"}}},
            "post": {"responses": {"201": {"description": "created"}}},
        },
        "/pets/{pet_id}": {"get": {"responses": {"200": {"description": "ok"}}}},
        "/retired": {"get": {"responses": {"200": {"description": "ok"}}}},
    },
}


def _configure():
    import django
    from django.conf import settings

    if not settings.configured:
        settings.configure(
            DEBUG=True,
            SECRET_KEY="runtime-intelligence-tests",
            ROOT_URLCONF="test_django_runtime_intelligence",
            ALLOWED_HOSTS=["testserver"],
            MIDDLEWARE=[],
        )
        django.setup()


if DJANGO:
    _configure()

    from django.http import JsonResponse
    from django.test import override_settings
    from django.urls import include, path
    from django.views import View

    class PetsView(View):
        http_method_names = ["get", "post", "delete"]

        def get(self, request):
            return JsonResponse({"pets": []})

        def post(self, request):
            return JsonResponse({}, status=201)

    class PetView(View):
        def get(self, request, pet_id):
            return JsonResponse({"id": pet_id})

    def legacy_view(request):
        """A plain function view: Django cannot tell which methods it accepts."""
        return JsonResponse({})

    urlpatterns = [
        path("pets", PetsView.as_view()),
        path("pets/<int:pet_id>", PetView.as_view()),
        path("nested/", include([path("deep/<slug:name>", PetsView.as_view())])),
        *django_urlpatterns(path="/docs", runtime_intelligence_spec=SPEC),
    ]


@unittest.skipUnless(DJANGO, "django is not installed")
class DjangoRuntimeIntelligenceTest(unittest.TestCase):
    def _get(self, path):
        from django.test import Client

        # Another Django suite in this directory configures settings first, so the
        # global ROOT_URLCONF cannot be relied on; point at this module's patterns.
        with override_settings(ROOT_URLCONF=__name__):
            return Client().get(path)

    def _snapshot(self):
        response = self._get("/docs/__flexdoc/runtime")
        self.assertEqual(response.status_code, 200)
        return json.loads(response.content)

    def test_reports_the_methods_a_class_based_view_declares_and_implements(self):
        routes = self._snapshot()["routes"]

        self.assertIn({"method": "GET", "path": "/pets"}, routes)
        self.assertIn({"method": "POST", "path": "/pets"}, routes)
        # DELETE is allowed by http_method_names but has no handler, so it is not a route.
        self.assertNotIn({"method": "DELETE", "path": "/pets"}, routes)

    def test_normalizes_django_path_converters(self):
        routes = self._snapshot()["routes"]

        self.assertIn({"method": "GET", "path": "/pets/{pet_id}"}, routes)
        self.assertIn({"method": "GET", "path": "/nested/deep/{name}"}, routes)

    def test_names_both_directions_of_drift(self):
        snapshot = self._snapshot()

        self.assertIn({"method": "GET", "path": "/nested/deep/{name}"}, snapshot["runtimeOnly"])
        self.assertIn({"method": "GET", "path": "/retired"}, snapshot["documentedOnly"])

    def test_excludes_the_docs_mount_from_discovered_routes(self):
        routes = self._snapshot()["routes"]

        self.assertEqual([route for route in routes if route["path"].startswith("/docs")], [])

    def test_declares_discovery_incomplete_rather_than_guessing_function_view_methods(self):
        from prauga_flexdoc.runtime_intelligence import discover_django_routes

        declared = discover_django_routes([path("pets", PetsView.as_view())])
        undeclarable = discover_django_routes([path("legacy", legacy_view)])

        self.assertTrue(declared["complete"])
        self.assertFalse(undeclarable["complete"])
        self.assertEqual(undeclarable["routes"], [])

    def test_reports_a_drf_style_action_map_when_one_is_present(self):
        from prauga_flexdoc.runtime_intelligence import discover_django_routes

        view = PetsView.as_view()
        view.actions = {"get": "list", "post": "create"}

        routes = discover_django_routes([path("viewset", view)])["routes"]

        self.assertEqual(routes, [{"method": "GET", "path": "/viewset"}, {"method": "POST", "path": "/viewset"}])

    def test_declares_discovery_incomplete_for_a_regex_route_it_cannot_read(self):
        from django.urls import re_path

        from prauga_flexdoc.runtime_intelligence import discover_django_routes

        discovery = discover_django_routes([re_path(r"^pets/(?P<pet_id>[0-9]+)$", PetsView.as_view())])

        self.assertFalse(discovery["complete"])
        self.assertEqual(discovery["routes"], [])

    def test_rejects_a_non_get_runtime_request(self):
        from django.test import Client

        with override_settings(ROOT_URLCONF=__name__):
            self.assertEqual(Client().post("/docs/__flexdoc/runtime").status_code, 405)

    def test_runtime_route_is_absent_unless_a_specification_is_supplied(self):
        names = [getattr(pattern, "name", None) for pattern in django_urlpatterns(path="/plain")]

        self.assertNotIn("flexdoc-runtime", names)


if __name__ == "__main__":
    unittest.main()
