# Go net/http

This example serves the shared OpenAPI 3.1 feature showcase from memory at `/openapi.json` and mounts the FlexDoc Go adapter at `/docs`. It exercises the same servers, auth metadata, parameters, request bodies, Try It, custom-server flow, API Client handoff, and code samples as the other direct-spec examples.

```bash
go run .
```

Open `http://localhost:3000/docs`.

The example is pinned to `github.com/prauga/flexdoc/adapters/go v0.3.0`. During this unreleased PR, repository CI substitutes the adapter from `../../adapters/go`; after the `adapters/go/v0.3.0` release tag is published, the manifest is directly runnable from a standalone checkout as written.
