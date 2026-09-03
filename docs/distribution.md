# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Every adapter release packages or embeds the version-matched renderer rather than implementing its own OpenAPI renderer.

## Current artifacts

| Artifact | Version | Release tag | Compatibility |
| --- | --- | --- | --- |
| `@prauga/flexdoc-client` | `2.2.0` | `js/v2.2.0` | canonical renderer; renderer contract v1 |
| `@prauga/flexdoc-backend` | `2.2.0` | `js/v2.2.0` | matching renderer; contract v1 |
| `@prauga/flexdoc-core` | `0.2.0` | `core/v0.2.0` | framework-neutral OpenAPI engine |
| `@prauga/flexdoc-cli` | `0.2.0` | `cli/v0.2.0` | compatible Prauga renderer |
| `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.3.0` | `java/v0.3.0` | renderer contract v1 |
| `prauga-flexdoc` | `0.2.0` | `python/v0.2.0` | ASGI adapter + embedded renderer |
| `prauga-flexdoc-axum` | `0.2.0` | `rust/v0.2.0` | Axum adapter + embedded renderer |
| `github.com/prauga/flexdoc/adapters/go` | `0.2.0` | `adapters/go/v0.2.0` | net/http adapter + embedded renderer |

The **FlexDoc 2.2.5 framework-coverage slice** adds the first .NET artifact:

| Artifact | Initial version | Release tag | Compatibility |
| --- | --- | --- | --- |
| `Prauga.FlexDoc.AspNetCore` | `0.1.0` | `dotnet/v0.1.0` | ASP.NET Core 8+; renderer contract v1 |

Versions are intentionally independent across ecosystems. The FlexDoc product milestone (`2.2.5` through `2.3.0`) tracks coordinated product capability; the renderer contract, not matching package numbers, is the cross-ecosystem compatibility boundary.

## Self-contained adapter artifacts

The canonical standalone JS/CSS is built from `packages/client`.

- Go consumes repository contents at the semantic tag, so renderer assets are committed and embedded with `go:embed`.
- Python wheels/sdists package renderer assets as `prauga_flexdoc` package data.
- Rust crates package renderer assets and compile them with `include_bytes!`.
- Spring Boot copies the canonical assets into `META-INF/flexdoc` during Maven packaging.
- ASP.NET Core embeds the canonical JS/CSS as assembly resources during `dotnet build`/`dotnet pack`.
- Node backend packages the same renderer into its npm artifact.

Go/Python/Rust committed assets are synchronized with `npm run sync:adapter-assets`, and CI byte-compares them to the canonical output. ASP.NET Core's dedicated CI builds the renderer first, packages the assembly, starts the example host, and byte-compares the renderer served by the running application to the canonical files.

No adapter requires a FlexDoc CDN at runtime.

## npm

The supported npm identities are `@prauga/flexdoc-client`, `@prauga/flexdoc-backend`, `@prauga/flexdoc-core`, and `@prauga/flexdoc-cli`. Client/backend use the coordinated `js/v...` release line; core and CLI use their own release tags.

Publishing uses npm Trusted Publishing/OIDC and requires the `@prauga` package Trusted Publisher relationships to point at the `prauga/flexdoc` repository and exact workflow files.

## NuGet

The .NET distribution is:

```text
Prauga.FlexDoc.AspNetCore
```

Release tags use `dotnet/v<version>`. `.github/workflows/publish-dotnet.yml` builds the canonical renderer, validates the tag against the project version, packs the NuGet artifact, and publishes with NuGet.org Trusted Publishing/OIDC.

Before the first publish, configure a NuGet.org Trusted Publishing policy for repository `Prauga/flexdoc` and workflow file `publish-dotnet.yml`, optionally restricted to the `nuget` GitHub environment. The workflow also needs the NuGet profile name in the `NUGET_USER` environment secret; no long-lived NuGet API key is stored in GitHub.

## Maven Central

The Java coordinate is:

```text
com.prauga.flexdoc:flexdoc-spring-boot-starter:0.3.0
```

The Java package namespace is `com.prauga.flexdoc.spring`.

## PyPI

The distribution name is `prauga-flexdoc`; the import package is `prauga_flexdoc`. The wheel contains the canonical renderer assets. `python/v<version>` builds the wheel/sdist and publishes through PyPI Trusted Publishing.

## crates.io

The crate is `prauga-flexdoc-axum`, imported as `prauga_flexdoc_axum`. `rust/v<version>` tests/packages the crate and uses crates.io Trusted Publishing for the release.

## Go

The module is `github.com/prauga/flexdoc/adapters/go`. Because it is a module in a monorepo subdirectory, its semantic tags use Go's submodule convention: `adapters/go/v<version>`. The renderer is embedded in the tagged module source, so there is no additional registry publication step.

Release-preparation CI keeps `examples/go-net-http/go.sum` committed even before a future Go tag exists. `scripts/verify-go-example-sum.mjs` deterministically hashes the exact tracked submodule release tree, including the root `LICENSE` that Go copies into submodule archives, and verifies the future-version checksum pin before the example is built with a local `replace`.

## Coordinated renderer release order

For a release that changes the canonical renderer:

1. Publish the matching `@prauga/flexdoc-client` release first.
2. Publish the Node backend/CLI releases that consume that renderer as required.
3. Publish or tag native adapters only after their package validation proves they contain the exact intended renderer.
4. `@prauga/flexdoc-core` remains independently versioned unless the release changes framework-neutral engine behavior.

Framework-only host additions such as a new ASP.NET Core package may begin at their ecosystem's own `0.x` version while still belonging to the broader FlexDoc product milestone.

## Release checks

Every release should verify at least:

- the expected renderer-contract version;
- exact renderer assets are present in the produced package;
- host HTML loads only local packaged assets by default;
- documentation-route secrets are not serialized to the browser;
- a representative OpenAPI document boots and Try It works;
- package metadata points at Prauga's public source and AGPL license;
- no publishing credential/signing secret exists in a produced package.
