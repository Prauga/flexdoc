# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Every adapter release packages or embeds the version-matched renderer rather than implementing its own OpenAPI renderer.

## Published artifacts and source versions

| Artifact | Version represented by source | Release tag | Compatibility |
| --- | --- | --- | --- |
| `@prauga/flexdoc-client` | `3.3.1` | `js/v3.3.1` | canonical renderer; renderer contract v1 |
| `@prauga/flexdoc-backend` | `3.3.1` | `js/v3.3.1` | matching renderer; contract v1 |
| `@prauga/flexdoc-core` | `0.5.2` | `core/v0.5.2` | framework-neutral OpenAPI engine + host-execution target-policy contract |
| `@prauga/flexdoc-cli` | `0.7.0` | `cli/v0.7.0` | Contract Validation + headless Runner consumer; compatible Prauga renderer |
| `Prauga.FlexDoc.AspNetCore` | `0.6.0` | `dotnet/v0.6.0` | ASP.NET Core 8+; renderer contract v1; HX-03 protection acknowledgement |
| `com.prauga.flexdoc:flexdoc-jvm` | `0.9.0` | `java/v0.9.0` | Java 17+ framework-neutral renderer host; HX-03 protection acknowledgement |
| `com.prauga.flexdoc:flexdoc-jaxrs` | `0.9.0` | `java/v0.9.0` | Jakarta REST/JAX-RS transport over `flexdoc-jvm` |
| `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.9.0` | `java/v0.9.0` | Spring Boot 3 transport over `flexdoc-jvm`; HX-03 property binding |
| `prauga-flexdoc` (PyPI) | `0.7.4` | `python/v0.7.4` | ASGI/WSGI adapter + embedded renderer |
| `prauga/flexdoc` | `0.4.6` | `Prauga/flexdoc-php` `v0.4.6` | PHP 8.2+; Composer/Packagist distribution mirrored to `Prauga/flexdoc-php` |
| `prauga-flexdoc` (RubyGems) | `0.4.6` | `ruby/v0.4.6` | Ruby 3.2+ Rack/Rails host + embedded renderer |
| `prauga-flexdoc-host-execution` | `0.1.1` | `rust-host/v0.1.1` | shared Rust native host-execution engine |
| `prauga-flexdoc-axum` | `0.5.6` | `rust/v0.5.6` | Axum adapter + embedded renderer |
| `prauga-flexdoc-actix` | `0.4.6` | `rust-actix/v0.4.6` | Actix Web adapter + embedded renderer |
| `prauga_flexdoc` (Hex) | `0.4.6` | `elixir/v0.4.6` | Plug/Phoenix adapter + embedded renderer |
| `github.com/prauga/flexdoc/adapters/go` | `0.5.6` | `adapters/go/v0.5.6` | net/http adapter + embedded renderer |

The table describes the versions encoded by the current source tree. A new source version is not considered published merely because it appears here; publication still requires its matching release workflow to complete successfully.

Versions are intentionally independent across ecosystems. FlexDoc 3.3 advanced client/backend to `3.3.0`, the Java family to `0.9.0` and ASP.NET Core to `0.6.0`. The 3.3.1 coordinated patch release then advanced every package carrying a shipped change since its last tag: client/backend to `3.3.1`, `@prauga/flexdoc-core` to `0.5.2`, Python to `0.7.4`, PHP/Ruby/Elixir to `0.4.6`, Go to `0.5.6`, Axum to `0.5.6`, Actix to `0.4.6` and the shared Rust host-execution crate to `0.1.1`. The Java family, ASP.NET Core and `@prauga/flexdoc-cli` were unchanged and remain at `0.9.0`, `0.6.0` and `0.7.0`. The renderer contract, not matching package numbers, remains the cross-ecosystem compatibility boundary.

## Self-contained adapter artifacts

The canonical standalone JS/CSS is built from `packages/client`.

- Go consumes repository contents at the semantic tag, so renderer assets are committed and embedded with `go:embed`.
- Python wheels/sdists package renderer assets as `prauga_flexdoc` package data.
- Ruby gems package the renderer assets with the framework-neutral host used by Rack and Rails.
- Rust Axum and Actix crates package renderer assets and compile them with `include_bytes!`.
- Elixir/Hex packages renderer assets with the Plug used directly or through Phoenix.
- ASP.NET Core embeds the canonical JS/CSS as assembly resources during `dotnet build`/`dotnet pack`.
- Java `flexdoc-jvm` copies the canonical assets into `META-INF/flexdoc` during Maven packaging. `flexdoc-jaxrs` and the Spring Boot starter depend on that artifact and do not own independent renderer copies.
- Node backend packages the same renderer into its npm artifact.

Go/Python/Ruby/Rust/Elixir committed assets are synchronized with `npm run sync:adapter-assets`, and CI byte-compares them to the canonical output. ASP.NET Core and Java dedicated CI lanes build the renderer first, package their native host, exercise representative live/runtime integrations, and byte-compare the renderer served or packaged by the adapter to the canonical files.

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

The FlexDoc Java family is prepared together at `0.9.0` for the HX-03 3.3.x security-parity patch:

```text
com.prauga.flexdoc:flexdoc-jvm:0.9.0
com.prauga.flexdoc:flexdoc-jaxrs:0.9.0
com.prauga.flexdoc:flexdoc-spring-boot-starter:0.9.0
```

`flexdoc-jvm` is the framework-neutral Java 17+ host and owns the packaged renderer. `flexdoc-jaxrs` is a Jakarta REST/JAX-RS response adapter. The Spring Boot starter preserves its existing configuration API while delegating HTML and asset hosting to `flexdoc-jvm`.

A single `java/v0.9.0` release validates the family version, installs the complete reactor locally, then publishes in dependency order: `flexdoc-jvm`, `flexdoc-jaxrs`, and `flexdoc-spring-boot-starter`. This allows Quarkus/Jakarta REST, Micronaut, Guice/Governator-style services, and Spring Boot to share one renderer host contract without package-level renderer forks.

## PyPI

The distribution name is `prauga-flexdoc`; the import package is `prauga_flexdoc`. The wheel contains the canonical renderer assets. `python/v<version>` builds the wheel/sdist and publishes through PyPI Trusted Publishing.

## Composer / Packagist

The Composer package is `prauga/flexdoc`. Its canonical source remains under `adapters/php` in `Prauga/flexdoc`; [`Prauga/flexdoc-php`](https://github.com/Prauga/flexdoc-php) is the standalone distribution repository intended for Composer/Packagist consumption and is synchronized from the monorepo.

PHP does not use a `php/v<version>` release in the monorepo. After the sync workflow copies `adapters/php` to `Prauga/flexdoc-php`, the standalone distribution repository publishes `v<version>` (for the 3.3.1 release, `v0.4.6`).

The distribution repository owns its standalone Composer validation/CI surface. Product development continues in `Prauga/flexdoc`, so fixes should be made in the monorepo first and then mirrored to `Prauga/flexdoc-php` rather than edited independently in the distribution copy.

## RubyGems

The gem is `prauga-flexdoc`. Release tags use `ruby/v<version>`. `.github/workflows/publish-ruby.yml` validates/tests the adapter, builds the gem, and publishes through RubyGems trusted publishing.

## crates.io

The crates are `prauga-flexdoc-host-execution`, `prauga-flexdoc-axum`, and `prauga-flexdoc-actix`. Each is released by its own tag and workflow: the framework-neutral host-execution crate uses `rust-host/v<version>` through `publish-rust-host.yml`, Axum uses `rust/v<version>` through `publish-rust.yml`, and Actix uses `rust-actix/v<version>` through `publish-rust-actix.yml`. Every workflow asserts the release tag against the version it is about to publish, so no workflow publishes a crate it is not named after.

The Axum and Actix crates depend on the host-execution crate, so their workflows fail fast when the version their manifest requires is not yet on crates.io, naming the `rust-host/v<version>` release to cut first. Publishing is ordered accordingly: host-execution, then the two adapters.

Each crate needs its own crates.io Trusted Publishing configuration for repository `Prauga/flexdoc`, the workflow file that publishes it, and the `crates-io` GitHub environment. A configuration on one crate does not authorize any other crate.

## Hex

The package is `prauga_flexdoc`. Release tags use `elixir/v<version>`. `.github/workflows/publish-elixir.yml` tests and builds the Plug package before publishing to Hex with the configured `HEX_API_KEY` release secret.

## Go

The module is `github.com/prauga/flexdoc/adapters/go`. Because it is a module in a monorepo subdirectory, its semantic tags use Go's submodule convention: `adapters/go/v<version>`. The renderer is embedded in the tagged module source, so there is no additional registry publication step.

Release-preparation branches keep Go examples pinned to the last published module version. After the new submodule tag is public, the lock-refresh PR updates `go.mod` and records the checksum returned by the Go module proxy. `scripts/verify-go-example-sum.mjs` verifies that a published version matches the proxy-provided checksum exactly; proxy/query failures are treated as errors rather than being mistaken for an unpublished tag.

## Coordinated renderer release order

For a release that changes the canonical renderer:

1. Prepare the source/package release in `Prauga/flexdoc` and, in the same release cycle, open the corresponding canonical release-data PR in `Prauga/flexdoc-website`.
2. Publish the matching `@prauga/flexdoc-client` release first.
3. Publish the Node backend/CLI releases that consume that renderer as required.
4. Publish or tag native adapters only after their package validation proves they contain the exact intended renderer.
5. Within an ecosystem family, publish base/native host packages before framework wrappers that depend on them.
6. `@prauga/flexdoc-core` remains independently versioned and is published only when framework-neutral engine or shared policy behavior changes.
7. Merge the paired `Prauga/flexdoc-website` release-data PR only after the package/tag matrix it advertises is actually public; the website serves that feed directly, so release metadata must never lead publication.

The paired website release-data PR is a required release artifact for every coordinated FlexDoc release, not optional website bookkeeping. Its release date, package matrix, announcement state, and public copy must be verified against the actual publication before it is merged.

Framework-only host additions may begin at their ecosystem's own `0.x` version while still belonging to the broader FlexDoc product milestone.

## Release checks

Every release should verify at least:

- the expected renderer-contract version;
- exact renderer assets are present in the produced package;
- host HTML loads only local packaged assets by default;
- documentation-route secrets are not serialized to the browser;
- a representative OpenAPI document boots and Try It works;
- package metadata points at Prauga's public source and AGPL license;
- no publishing credential/signing secret exists in a produced package;
- the paired `Prauga/flexdoc-website` release-data PR exists and matches the intended public package/tag matrix, while remaining unmerged until publication is real.