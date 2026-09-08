# @prauga/flexdoc-cli

The FlexDoc CLI builds and serves self-contained OpenAPI documentation, consumes backend-produced FlexDoc Contract Validation, and runs portable API Client artifacts headlessly for local or CI workflows.

## Commands

### `serve`

```bash
npx @prauga/flexdoc-cli serve openapi.yaml
```

Serves the generated documentation locally at `http://127.0.0.1:4174/`.

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
```

Rebuilds when the root OpenAPI file changes and reloads connected browser pages automatically.

### `build`

```bash
npx @prauga/flexdoc-cli build openapi.yaml --out ./docs
```

Produces a static directory containing:

```text
docs/
├── index.html
├── flexdoc.js
├── flexdoc.css
└── openapi.json
```

A small `.flexdoc-generated` marker is also written so later FlexDoc builds can safely distinguish their own output directory from an unrelated directory.

### `validate`

```bash
npx @prauga/flexdoc-cli validate http://127.0.0.1:3000/docs/__flexdoc/runtime
```

`validate` consumes the structured `validation` object produced by a FlexDoc Runtime Intelligence endpoint. It does **not** reimplement contract comparison in the CLI; the installed backend remains authoritative.

Machine-readable output:

```bash
npx @prauga/flexdoc-cli validate \
  http://127.0.0.1:3000/docs/__flexdoc/runtime \
  --json
```

Protected documentation/runtime endpoints can be called with arbitrary headers or authorization shortcuts:

```bash
npx @prauga/flexdoc-cli validate "$FLEXDOC_RUNTIME_URL" \
  --header "X-CI-Run:$GITHUB_RUN_ID" \
  --bearer "$FLEXDOC_TOKEN"

npx @prauga/flexdoc-cli validate "$FLEXDOC_RUNTIME_URL" \
  --basic "$FLEXDOC_BASIC_CREDENTIALS"
```

`--header <name:value>` is repeatable. Do not combine an explicit `Authorization` header with `--bearer` or `--basic`, and do not use bearer and basic together. CLI arguments can be visible to local process inspection, so supply credentials from your CI secret facility rather than committing them to scripts or repository configuration.

By default, `validate` exits `1` only when the backend validation status is `fail` (or when the endpoint/payload cannot be consumed). `warn` and `partial` remain successful so the backend's severity model is preserved without surprising existing CI.

To make CI stricter, add a fail policy:

```bash
# Fail for errors or warnings.
flexdoc validate "$FLEXDOC_RUNTIME_URL" --fail-on warning

# Fail for any finding, including informational partial-discovery findings.
flexdoc validate "$FLEXDOC_RUNTIME_URL" --fail-on info
```

Accepted values are `error`, `warning`, and `info`. `--fail-on error` is equivalent to the default policy.

The current validation-producing hosts are the Node backend integrations: Express, Fastify, Hono, and NestJS on its supported Express/Fastify adapters. FastAPI, ASP.NET Core, and Spring continue to emit compatible Runtime Intelligence route snapshots but do not yet emit the operation-level `validation` object; `flexdoc validate` intentionally fails rather than inventing a second validator for those snapshots.

### `run`

Export a saved request, folder, or collection from the API Client workspace, then execute that artifact outside the browser:

```bash
flexdoc run ./pets.flexdoc.json
```

The artifact is not a second Runner-specific request model. It is a versioned, history-free snapshot of the canonical FlexDoc collection/folder/request/auth/script/environment entities. Request ordering therefore remains the same saved-request ordering used by the workspace Runner.

Machine-readable CI output:

```bash
flexdoc run ./pets.flexdoc.json --json
```

Write the same JSON report to a file while keeping normal terminal output:

```bash
flexdoc run ./pets.flexdoc.json --report ./artifacts/flexdoc-run.json
```

Stop after the first runner failure:

```bash
flexdoc run ./pets.flexdoc.json --stop-on-failure
```

Runner pass/fail follows the existing API Client rules. A transport error, script error, or failed `flex.test(...)` assertion fails an item. HTTP status alone does not, so a request that intentionally expects a `404` can pass when its tests pass. A pre-request script failure does not execute transport and does not invent an HTTP result.

#### Direct versus host execution

Without `--host`, requests execute directly from the CLI using the same request builder and `flex.*` scripting runtime as the workspace:

```bash
flexdoc run ./pets.flexdoc.json
```

With `--host`, the CLI first reads the **existing** public host-execution advertisement from the FlexDoc documentation page:

```bash
flexdoc run ./pets.flexdoc.json \
  --host https://api.example.com/docs
```

The CLI does not create another execute route or protocol. When a request already requires a host capability such as Digest/Hawk/OAuth 1/AWS SigV4/client-certificate/cookie-jar execution, the canonical executor sends the fully resolved draft to the advertised existing `__flexdoc/execute` endpoint. Ordinary requests remain direct; private/VPC force-host expansion is later backend-execution work rather than a hidden 3.2 behavior change.

Scripts run in the CLI process in 3.2. Variable resolution, pre-request scripts, inherited auth, transport, response tests, collection/environment mutations, stop-on-failure, and cancellation therefore keep the same ordering as the workspace Runner. Moving script execution into a backend host would require a new host protocol capability and is not part of this command.

#### Authenticating to protected FlexDoc hosts

`run --host` reuses the same authentication story as `validate`:

```bash
flexdoc run ./pets.flexdoc.json \
  --host "$FLEXDOC_DOCS_URL" \
  --header "X-CI-Run:$GITHUB_RUN_ID" \
  --bearer "$FLEXDOC_TOKEN"

flexdoc run ./pets.flexdoc.json \
  --host "$FLEXDOC_DOCS_URL" \
  --basic "$FLEXDOC_BASIC_CREDENTIALS"
```

These credentials authenticate only the FlexDoc documentation page and its advertised execution endpoint. They are deliberately **not** copied onto direct target API requests. API authorization remains part of the exported canonical request/collection/folder/environment model.

#### JSON report

The report is intentionally smaller than persisted workspace history. It contains:

- artifact/run identity and scope;
- run start/end/duration and aggregate pass/fail/cancel counts;
- request id/name and collection/folder identity;
- actual executor (`direct`, `host`, or `null` when transport never ran);
- HTTP status/status text and response timing when available;
- `flex.test(...)` results;
- transport and script errors.

Response bodies and response headers are not copied into the machine report. The report is for CI outcome/evidence, not a second response-history store.

Exit codes:

```text
0    run passed
1    one or more items failed / run stopped on failure
130  run was interrupted/cancelled
```

Portable artifacts currently reject in-memory multipart/binary `File` payloads rather than silently serializing unusable browser objects. Defining portable file payload encoding is separate from the request-model contract and must remain explicit.

3.2 deliberately does **not** add CSV/JSON iteration data, concurrency, drag reordering, Newman compatibility, native execute implementations, private-network policy changes, or a second `__flexdoc/execute` endpoint.

## Inputs

`build` and `serve` accept:

- a local `.json`, `.yaml`, or `.yml` OpenAPI document;
- an `http://` or `https://` OpenAPI URL.

External `$ref` documents are bundled into `openapi.json` during `build`/`serve`, including schema-only JSON/YAML files and nested external references. A deployed static export therefore does not need the original external spec files at runtime.

`validate` accepts an absolute `http://` or `https://` Runtime Intelligence endpoint URL.

`run` accepts a local FlexDoc Runner JSON artifact exported from the canonical API Client workspace.

## Options

### `build`

```text
--out <dir>          Output directory (default: flexdoc-dist)
--base-path <path>   Deployment base path (default: /)
--title <title>      Override the OpenAPI document title
--force              Replace an existing non-FlexDoc output directory
```

### `serve`

```text
--host <host>        Bind host (default: 127.0.0.1)
--port <port>        Bind port (default: 4174)
--base-path <path>   Serve under a path such as /docs/
--title <title>      Override the OpenAPI document title
--watch              Rebuild and live-reload when the root file changes
```

### `validate`

```text
--json                     Print the backend validation object as JSON
--header <name:value>      Add a request header; repeatable
--bearer <token>           Send a Bearer Authorization header
--basic <user:password>    Send HTTP Basic authorization
--fail-on <level>          error | warning | info (default: error)
```

### `run`

```text
--host <docs-url>          Read the existing host-execution advertisement from this FlexDoc page
--header <name:value>      Add a docs-host header; repeatable (requires --host)
--bearer <token>           Bearer auth for docs/execute host (requires --host)
--basic <user:password>    Basic auth for docs/execute host (requires --host)
--stop-on-failure          Stop after the first failed request
--json                     Print the machine-readable run report
--report <file>            Write the JSON run report to a file
```

## Static deployment examples

GitHub Pages project site:

```bash
flexdoc build openapi.yaml --out ./docs --base-path /my-repository/
```

Root-domain/S3/nginx deployment:

```bash
flexdoc build openapi.yaml --out ./public
```

The generated renderer JS/CSS is copied from the version-matched `@prauga/flexdoc-client` dependency. No runtime CDN or FlexDoc service is required.
