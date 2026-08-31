# Go net/http

This example keeps the OpenAPI 3.1 document in memory, serves it at `/openapi.json`, and points the published Go adapter at that URL.

```bash
go run .
```

Open `http://localhost:8080/docs`.

The FlexDoc Go module is intentionally pinned to `v0.1.0`; repository CI requires it to match `adapters/go/VERSION`.
