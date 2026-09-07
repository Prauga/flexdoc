# FastAPI + FlexDoc 3.0

FastAPI generates the OpenAPI 3.1 document from route declarations and Pydantic models, while `setup_fastapi_flexdoc` mounts FlexDoc inside the same running application and enables the native FastAPI/Starlette Runtime Intelligence integration.

The example includes multiple servers, API-key/Bearer/Basic security metadata, path/query/header parameters, JSON/form/multipart bodies, uploads, Try It, API Client handoff and code samples. `GET /internal/health` is registered with `include_in_schema=False`, so opening the Runtime panel shows a genuine implemented-but-undocumented route from the live Starlette route tree.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open `http://127.0.0.1:8000/docs`.

`prauga-flexdoc` is pinned to `0.6.1` until the coordinated 3.0 release versioning pass. Repository CI installs the wheel built from the current commit when validating source changes.
