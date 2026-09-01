# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Every adapter release packages or embeds the version-matched renderer rather than implementing its own OpenAPI renderer.

## Release targets

These are the release candidates encoded by this PR. They are not considered published until the coordinated publish/merge sequence completes; registry consumers may still resolve the previously published versions until then.

| Artifact | Target version | Release tag | Compatibility |
| --- | --- | --- | --- |
| `@prauga/flexdoc-client` | `2.2.0` | `js/v2.2.0` | canonical renderer; renderer contract v1 |
| `@prauga/flexdoc-backend` | `2.2.0` | `js/v2.2.0` | matching renderer; contract v1 |
| `@prauga/flexdoc-core` | `0.2.0` | `core/v0.2.0` | framework-neutral OpenAPI engine |
| `@prauga/flexdoc-cli` | `0.2.0` | `cli/v0.2.0` | compatible Prauga renderer |
| `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.3.0` | `java/v0.3.0` | renderer contract v1 |
| `prauga-flexdoc` | `0.2.0` | `python/v0.2.0` | ASGI adapter + embedded renderer |
| `prauga-flexdoc-axum` | `0.2.0` | `rust/v0.2.0` | Axum adapter + embedded renderer |
| `github.com/prauga/flexdoc/adapters/go` | `0.2.0` | `adapters/go/v0.2.0` | net/http adapter + embedded renderer |

Versions are intentionally independent across ecosystems. The renderer contract, not matching version numbers, is the cross-ecosystem compatibility boundary.

## Self-contained adapter artifacts

The canonical standalone JS/CSS is built from `packages/client` and synchronized into the Go, Python, and Rust package trees by `npm run sync:adapter-assets`. CI runs `npm run check:adapter-assets` after building the client and byte-compares every committed adapter asset against the canonical output.

This is required because the ecosystems package source differently:

- Go consumes repository contents at the semantic tag, so renderer assets are committed and embedded with `go:embed`.
- Python wheels/sdists package renderer assets as `prauga_flexdoc` package data.
- Rust crates package renderer assets and compile them with `include_bytes!`.
- Spring Boot copies the canonical assets into `META-INF/flexdoc` during Maven packaging.
- Node backend packages the same renderer into its npm artifact.

No adapter requires a FlexDoc CDN at runtime.

## npm

The supported npm identities are `@prauga/flexdoc-client`, `@prauga/flexdoc-backend`, `@prauga/flexdoc-core`, and `@prauga/flexdoc-cli`. Client/backend use the coordinated `js/v...` release line; core and CLI use their own release tags.

Publishing uses npm Trusted Publishing/OIDC and therefore requires the `@prauga` package Trusted Publisher relationships to point at the final `prauga/flexdoc` repository and exact workflow files.

## Maven Central

The target coordinate for this release is:

```text
com.prauga.flexdoc:flexdoc-spring-boot-starter:0.3.0
```

The Java package namespace is `com.prauga.flexdoc.spring`. Before publication under this coordinate, verify the `com.prauga.flexdoc` namespace in Central Portal. The old `io.github.bluejeans117...` artifact is not modified or deprecated by the npm migration.

## PyPI

The distribution name is `prauga-flexdoc`; the import package is `prauga_flexdoc`. The wheel contains the canonical renderer assets. `python/v<version>` builds the wheel/sdist and publishes through PyPI Trusted Publishing.

## crates.io

The crate is `prauga-flexdoc-axum`, imported as `prauga_flexdoc_axum`. `rust/v<version>` tests/packages the crate and uses crates.io Trusted Publishing for the release.

## Go

The module is `github.com/prauga/flexdoc/adapters/go`. Because it is a module in a monorepo subdirectory, its semantic tags use Go's submodule convention: `adapters/go/v<version>`. The renderer is embedded in the tagged module source, so there is no additional registry publication step.

Release-preparation CI keeps `examples/go-net-http/go.sum` committed even before the next Go tag exists. `scripts/verify-go-example-sum.mjs` deterministically hashes the exact tracked submodule release tree, including the root `LICENSE` that Go copies into submodule archives, and verifies the future-version checksum pin before the example is built with a local `replace`.

## Coordinated release order

For a renderer release such as FlexDoc 2.2, publish in dependency order:

1. Publish `@prauga/flexdoc-client@2.2.0` first.
2. After the client version is visible in npm, publish `@prauga/flexdoc-backend@2.2.0` and `@prauga/flexdoc-cli@0.2.0`. The CLI depends on `@prauga/flexdoc-client@^2.2.0`.
3. Publish/tag the Java, Python, Rust, and Go adapters after the canonical renderer release is available and the synchronized embedded assets have been validated.
4. `@prauga/flexdoc-core@0.2.0` is independent of that dependency chain and may be published separately.

Do not merge a release-preparation PR that pins unpublished example versions unless the coordinated publish sequence is being executed at the same time. CI validates local release candidates through local package installs, wheels, and module replacements; it does not prove that registry consumers can resolve the target versions before publication.

## Release checks

Every release should verify at least:

- the expected renderer-contract version;
- exact renderer assets are present in the produced package;
- host HTML loads only local packaged assets by default;
- documentation-route secrets are not serialized to the browser;
- a representative OpenAPI document boots and Try It works;
- package metadata points at Prauga's public source and AGPL license;
- no publishing credential/signing secret exists in a produced package.
