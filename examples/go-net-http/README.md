# Go net/http

This example serves the shared OpenAPI 3.1 feature showcase from memory at `/openapi.json` and mounts the FlexDoc Go adapter at `/docs`. It exercises the same servers, auth metadata, parameters, request bodies, Try It, custom-server flow, API Client handoff, and code samples as the other direct-spec examples.

```bash
go run .
```

Open `http://localhost:3000/docs`.

The example is pinned to published `github.com/prauga/flexdoc/adapters/go v0.4.0` and resolves through the public Go module infrastructure. Repository CI may substitute the adapter from `../../adapters/go` when validating local source changes.
