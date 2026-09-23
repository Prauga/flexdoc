# FastAPI + FlexDoc 3.3

FastAPI generates the OpenAPI 3.1 document from route declarations and Pydantic models, while `setup_fastapi_flexdoc` mounts FlexDoc inside the same running application and enables the native FastAPI/Starlette Runtime Intelligence integration.

`GET /internal/health` is registered with `include_in_schema=False` and listed in `acknowledged_undocumented`, so that finding is informational and the route stays in the runtime record. `POST /internal/reindex` is also hidden from the generated schema and is not acknowledged, so `flexdoc validate` fails and the finding opens in the API Client.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open `http://127.0.0.1:8000/docs`.

`prauga-flexdoc` is pinned to `0.9.0`. That published package reports the route snapshot and does not emit the validation object. Repository CI installs the wheel built from the current commit when validating source changes, and that build does.
