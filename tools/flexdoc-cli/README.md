# @prauga/flexdoc-cli

The FlexDoc CLI builds and serves self-contained OpenAPI documentation and consumes backend-produced FlexDoc 3.1 Contract Validation in local or CI workflows.

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

`validate` consumes the structured `validation` object produced by a Node FlexDoc 3.1 Runtime Intelligence endpoint. It does **not** reimplement contract comparison in the CLI; the installed backend remains authoritative.

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

The current 3.1 validation-producing hosts are the Node backend integrations: Express, Fastify, Hono, and NestJS on its supported Express/Fastify adapters. FastAPI, ASP.NET Core, and Spring continue to emit compatible Runtime Intelligence route snapshots in this cut, but do not yet emit the 3.1 `validation` object; `flexdoc validate` intentionally fails rather than inventing a second validator for those snapshots.

## Inputs

`build` and `serve` accept:

- a local `.json`, `.yaml`, or `.yml` OpenAPI document;
- an `http://` or `https://` OpenAPI URL.

External `$ref` documents are bundled into `openapi.json` during `build`/`serve`, including schema-only JSON/YAML files and nested external references. A deployed static export therefore does not need the original external spec files at runtime.

`validate` accepts an absolute `http://` or `https://` Runtime Intelligence endpoint URL.

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
