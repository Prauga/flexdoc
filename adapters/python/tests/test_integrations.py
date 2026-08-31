import asyncio

from prauga_flexdoc import setup_fastapi_flexdoc


class FakeFastAPI:
    openapi_url = "/openapi.json"
    docs_url = None
    redoc_url = None

    def __init__(self):
        self.mounts = []

    def mount(self, path, app):
        self.mounts.append((path, app))


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

    async def _unused():
        pass

    page, asset, missing = asyncio.run(run())
    assert page[0]["status"] == 200
    assert b"/openapi.json" in page[1]["body"]
    assert asset[0]["status"] == 200
    assert len(asset[1]["body"]) > 0
    assert missing[0]["status"] == 404


async def _record(messages, message):
    messages.append(message)
