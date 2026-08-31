# FastAPI

FastAPI generates OpenAPI from route decorators and Pydantic models; the published `prauga-flexdoc` ASGI app is mounted at `/docs` and reads FastAPI's `/openapi.json` document.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open `http://127.0.0.1:8000/docs`.

`prauga-flexdoc` is intentionally pinned to `0.1.0`; repository CI requires it to match the current Python adapter version.
