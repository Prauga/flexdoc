import asyncio
import json

from prauga_flexdoc import setup_fastapi_flexdoc


class FakeRoute:
    def __init__(self, path, methods):
        self.path = path
        self.methods = methods


class FakeFastAPI:
    openapi_url = "/openapi.json"
    docs_url = None
    redoc_url = None
    swagger_ui_oauth2_redirect_url = None

    def __init__(self):
        self.mounts = []
        self.routes = []
        self.spec = {"paths": {}}

    def mount(self, path, app):
        self.mounts.append((path, app))

    def openapi(self):
        return self.spec


def test_setup_fastapi_flexdoc_uses_generated_openapi_endpoint():
    app = FakeFastAPI()
    docs = setup_fastapi_flexdoc(app, "/reference", title="Orders API")

    assert app.mounts == [("/reference", docs)]
    assert docs.config.spec_url == "/openapi.json"
    assert docs.config.title == "Orders API"


def test_setup_fastapi_flexdoc_rejects_builtin_docs_collision():
    app = FakeFastAPI()
    app.docs_url = "/docs"

    try:
        setup_fastapi_flexdoc(app)
    except ValueError as exc:
        assert "conflicts with FastAPI's built-in Swagger UI route" in str(exc)
        assert "docs_url=None" in str(exc)
    else:
        raise AssertionError("expected setup_fastapi_flexdoc to reject the built-in docs route")


def test_setup_fastapi_flexdoc_requires_openapi_generation():
    app = FakeFastAPI()
    app.openapi_url = None

    try:
        setup_fastapi_flexdoc(app)
    except ValueError as exc:
        assert "OpenAPI generation is disabled" in str(exc)
    else:
        raise AssertionError("expected setup_fastapi_flexdoc to reject disabled OpenAPI")


def test_fastapi_mounted_app_serves_docs_and_assets():
    app = FakeFastAPI()
    docs = setup_fastapi_flexdoc(app, "/reference", title="Orders API")

    async def request(path):
        messages = []
        await docs(
            {"type": "http", "path": path},
            lambda: None,
            lambda message: _record(messages, message),
        )
        return messages

    async def run():
        page = await request("/reference")
        asset = await request("/reference/__flexdoc/renderer.js")
        missing = await request("/missing")
        return page, asset, missing

    page, asset, missing = asyncio.run(run())
    assert page[0]["status"] == 200
    assert b"/openapi.json" in page[1]["body"]
    assert b"runtimeIntelligence" not in page[1]["body"]
    assert asset[0]["status"] == 200
    assert len(asset[1]["body"]) > 0
    assert missing[0]["status"] == 404


def test_fastapi_runtime_intelligence_is_opt_in_and_live():
    app = FakeFastAPI()
    app.routes = [
        FakeRoute("/orders/{order_id}", {"GET"}),
        FakeRoute("/internal", {"POST"}),
    ]
    app.spec = {
        "paths": {
            "/orders/{order_id}": {"get": {}},
            "/missing": {"post": {}},
        }
    }
    docs = setup_fastapi_flexdoc(app, "/reference", title="Orders API", runtime_intelligence=True)

    async def request(path, method="GET"):
        messages = []
        await docs(
            {
                "type": "http",
                "path": path,
                "method": method,
                "scheme": "https",
                "headers": [(b"host", b"api.example.test")],
            },
            lambda: None,
            lambda message: _record(messages, message),
        )
        return messages

    async def run():
        page = await request("/reference")
        runtime = await request("/reference/__flexdoc/runtime")
        rejected = await request("/reference/__flexdoc/runtime", "POST")
        return page, runtime, rejected

    page, runtime, rejected = asyncio.run(run())
    assert b'"runtimeIntelligence":{"available":true,"endpoint":"/reference/__flexdoc/runtime","framework":"fastapi"}' in page[1]["body"]
    assert runtime[0]["status"] == 200
    assert (b"cache-control", b"no-store") in runtime[0]["headers"]
    snapshot = json.loads(runtime[1]["body"])
    assert snapshot["framework"] == "fastapi"
    assert snapshot["runtime"]["name"] == "python"
    assert snapshot["serverOrigin"] == "https://api.example.test"
    assert snapshot["runtimeOnly"] == [{"method": "POST", "path": "/internal"}]
    assert snapshot["documentedOnly"] == [{"method": "POST", "path": "/missing"}]
    assert rejected[0]["status"] == 405


async def _record(messages, message):
    messages.append(message)
