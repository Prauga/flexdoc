# @prauga/flexdoc-cli

The FlexDoc CLI turns an OpenAPI document into the canonical FlexDoc browser experience without requiring React or a backend framework.

## Commands

```bash
npx @prauga/flexdoc-cli serve openapi.yaml
```

Serves the generated documentation locally at `http://127.0.0.1:4174/`.

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
```

Rebuilds when the root OpenAPI file changes and reloads connected browser pages automatically.

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

## Inputs

The input may be:

- a local `.json`, `.yaml`, or `.yml` OpenAPI document
- an `http://` or `https://` OpenAPI URL

External `$ref` documents are bundled into `openapi.json` during `build`/`serve`, including schema-only JSON/YAML files and nested external references. A deployed static export therefore does not need the original external spec files at runtime.

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
