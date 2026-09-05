# FastAPI + FlexDoc

FastAPI generates OpenAPI 3.1 from route declarations and Pydantic models; `prauga-flexdoc` mounts the self-contained renderer at `/docs` and consumes `/openapi.json`. The example includes multiple servers, API-key/Bearer/Basic security metadata, path/query/header parameters, JSON/form/multipart bodies, uploads, Try It, custom servers, API Client handoff, and code samples.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open `http://127.0.0.1:8000/docs`.

`prauga-flexdoc` is pinned to `0.4.0`. During this release PR, CI installs the wheel built from the same commit; after `0.4.0` is published, the requirements file is directly installable as written.
