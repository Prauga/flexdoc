from prauga_flexdoc import setup_fastapi_flexdoc


class FakeFastAPI:
    openapi_url = "/openapi.json"

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


def test_setup_fastapi_flexdoc_requires_openapi_generation():
    app = FakeFastAPI()
    app.openapi_url = None

    try:
        setup_fastapi_flexdoc(app)
    except ValueError as exc:
        assert "OpenAPI generation is disabled" in str(exc)
    else:
        raise AssertionError("expected setup_fastapi_flexdoc to reject disabled OpenAPI")
