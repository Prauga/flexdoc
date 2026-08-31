# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Distribution should preserve that architecture: a Java, Python, Rust, or Go integration packages/serves the version-matched renderer rather than implementing its own OpenAPI renderer.

## Version model

The renderer contract is the compatibility boundary between the shared browser product and language adapters.

| Artifact | Release line | Compatibility |
| --- | --- | --- |
| `@prauga/flexdoc-client` | `2.x` | canonical renderer; renderer contract v1 |
| `@prauga/flexdoc-backend` | `2.x` | packages the matching 2.x standalone renderer; contract v1 |
| Spring Boot starter | `0.1.x` initially | renderer contract v1 / FlexDoc renderer 2.x |
| Python ASGI adapter | `0.x` source | renderer contract v1; PyPI publishing not configured yet |
| Rust Axum adapter | `0.x` source | renderer contract v1; crates.io publishing not configured yet |
| Go `net/http` adapter | `0.x` source | renderer contract v1; semantic module release not tagged yet |

Do not synchronize versions across registries merely for aesthetics. Existing npm packages have release history, while newer ecosystem adapters do not. Instead, CI and package documentation must make renderer-contract compatibility explicit.

A breaking renderer-contract change requires a new contract major. An adapter can evolve independently while it continues to consume the same contract.

## Release tags

Registry releases are intentionally scoped by ecosystem so independent adapter versions do not trigger unrelated publishers:

- `js/v<version>` publishes the coordinated npm client/backend release;
- `java/v<version>` publishes the Spring Boot adapter to Maven Central.

Python, Rust, and Go should gain equivalent ecosystem-specific tag families when automated publishing is added.

## npm

The npm packages are public scoped packages:

- `@prauga/flexdoc-client`
- `@prauga/flexdoc-backend`

The release workflows use npm Trusted Publishing through GitHub OIDC. No long-lived `NPM_TOKEN` is required. The trusted-publisher relationship on npmjs.com must point to the exact GitHub repository and workflow filename for each package.

Release policy:

1. merge only after client/backend tests, standalone build checks, contract validation, backend asset checks and adapter verification are green;
2. create an immutable `js/v<version>` Git tag/GitHub Release;
3. let the client and backend workflows validate that the tag matches the committed package version;
4. inspect the packed artifact before publication;
5. publish using npm Trusted Publishing;
6. never rewrite a registry version. Fixes receive a new patch version.

The two npm packages should remain on the same 2.x version for now because the backend vendors the canonical client renderer and coordinated versions make that relationship obvious.

## Maven Central / Spring Boot

Coordinates:

```text
com.prauga.flexdoc:flexdoc-spring-boot-starter:0.1.0
```

The Maven module contains the canonical renderer JS/CSS under `META-INF/flexdoc` and serves those local assets at runtime. It does not contain an alternate Java renderer.

The POM includes the project URL, AGPL license, developer/SCM metadata, sources artifact and Javadocs artifact required for a normal Central release. Its `release` Maven profile adds GPG signing and Sonatype's Central Publishing Maven Plugin. The Central plugin is configured for automatic publication and waits until Central reports the deployment as published.

The GitHub release workflow imports the signing key and configures Maven Central authentication from repository secrets. Secret values must never be committed. The expected GitHub Actions secret names are:

- `MAVEN_CENTRAL_USERNAME`
- `MAVEN_CENTRAL_PASSWORD`
- `MAVEN_GPG_PRIVATE_KEY`
- `MAVEN_GPG_PASSPHRASE`

For a Java release:

1. ensure the `io.github.bluejeans117` namespace is verified in Central Portal;
2. ensure the Central user token and signing-key secrets are configured in GitHub Actions;
3. build and validate the canonical renderer and Java release profile in CI;
4. create an immutable `java/v<version>` Git tag/GitHub Release;
5. let the workflow verify the tag against `project.version`;
6. let Maven sign the POM, main JAR, sources JAR and Javadocs JAR and deploy them through the Central Portal plugin;
7. confirm the workflow reaches Central's `published` state before announcing the artifact as generally available.

## Python / PyPI

The repository now contains a dependency-free ASGI adapter under `adapters/python`. It can be mounted by FastAPI, Starlette, Django ASGI, Quart, or another ASGI host and serves the canonical renderer rather than reimplementing it.

Before the first PyPI release:

- choose/check the final PyPI package name;
- add Trusted Publishing/OIDC from GitHub Actions;
- copy the exact version-matched renderer JS/CSS into the wheel/sdist during release packaging;
- test the built wheel in a clean environment;
- declare renderer-contract compatibility in package metadata/docs.

Until that packaging path is implemented, the source adapter accepts an explicit local renderer asset directory.

## Rust / crates.io

The repository now contains an Axum adapter under `adapters/rust`. It hosts the same canonical browser renderer and does not contain a Rust OpenAPI renderer.

Before the first crates.io release:

- confirm package-name availability and the current crates.io publishing/auth mechanism;
- copy/embed the exact canonical renderer assets into the produced crate package;
- run `cargo package` and install/test the produced package rather than only the source tree;
- declare renderer-contract compatibility in package metadata/docs.

Until release packaging is implemented, the source adapter accepts a local renderer asset directory.

## Go modules

The repository now contains a standard-library `net/http` adapter under `adapters/go`. The handler accepts any `fs.FS`, which lets applications use an on-disk renderer directory or their own `go:embed` bundle while keeping the adapter independent from a second renderer implementation.

Before the first Go module release:

- decide the final stable module path;
- follow Go's submodule semantic-tag convention if it remains in this monorepo;
- provide a release packaging/generation path that includes the exact canonical renderer assets or a documented generated embed package;
- verify the tagged module through a clean external consumer and `pkg.go.dev` indexing.

## Release compatibility checks

Every adapter release should verify at least:

- renderer contract version expected by the adapter;
- exact renderer assets are present in the produced package or explicitly supplied through the documented local-asset boundary;
- host HTML loads only local packaged assets by default;
- no documentation-route secret is serialized to the browser;
- basic generated page boots with a representative OpenAPI document;
- package metadata points back to the public FlexDoc source/license;
- no publishing credential or signing secret exists in the produced package.

## Repository boundary

The core FlexDoc repository is intended to remain public. The renderer, OpenAPI engine, local API-client capabilities, CLI/static distribution and framework adapters benefit from being auditable and self-hostable.

If FlexDoc later adds commercial cloud functionality, account/team sync, hosted secret storage, RBAC/SSO, cloud execution, analytics, monitors and billing can live behind a separate service/repository boundary. Registry publication of the open-source adapters should not depend on that commercial service.
