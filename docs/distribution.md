# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Distribution should preserve that architecture: a Java, Python, Rust, or Go integration packages/serves the version-matched renderer rather than implementing its own OpenAPI renderer.

## Version model

The renderer contract is the compatibility boundary between the shared browser product and language adapters.

| Artifact | Release line | Compatibility |
| --- | --- | --- |
| `@bluejeans/flexdoc-client` | `2.x` | canonical renderer; renderer contract v1 |
| `@bluejeans/flexdoc-backend` | `2.x` | packages the matching 2.x standalone renderer; contract v1 |
| Spring Boot starter | `0.1.x` initially | renderer contract v1 / FlexDoc renderer 2.x |
| Python adapter | future independent version | declare supported renderer contract |
| Rust adapter | future independent version | declare supported renderer contract |
| Go adapter | future independent module version | declare supported renderer contract |

Do not synchronize versions across registries merely for aesthetics. Existing npm packages have release history, while a new Maven artifact does not. Instead, CI and package documentation must make renderer-contract compatibility explicit.

A breaking renderer-contract change requires a new contract major. An adapter can evolve independently while it continues to consume the same contract.

## npm

The npm packages are public scoped packages:

- `@bluejeans/flexdoc-client`
- `@bluejeans/flexdoc-backend`

For the consolidated renderer architecture, both packages move to `2.0.0`.

Recommended release policy:

1. merge only after client/backend tests, standalone build checks, contract validation, backend asset checks and Java verification are green;
2. create an immutable Git tag/GitHub Release for the version;
3. publish with npm Trusted Publishing (OIDC) where supported, rather than storing a long-lived npm automation token;
4. publish with provenance enabled;
5. inspect the packed artifact (`npm pack --dry-run` or equivalent) before publishing;
6. never rewrite a registry version. Fixes receive a new patch version.

The two npm packages should remain on the same 2.x version for now because the backend vendors the canonical client renderer and coordinated versions make that relationship obvious.

## Maven Central / Spring Boot

Coordinates:

```text
io.github.bluejeans117.flexdoc:flexdoc-spring-boot-starter:0.1.0
```

The Maven module contains the canonical renderer JS/CSS under `META-INF/flexdoc` and serves those local assets at runtime. It does not contain an alternate Java renderer.

The POM includes the project URL, AGPL license, developer/SCM metadata, sources artifact and Javadocs artifact needed for a normal Central release. Registry/account configuration and signing/publishing credentials are intentionally not committed.

Before the first Central publication:

1. create/sign in to a Maven Central Portal account;
2. verify ownership of the `io.github.bluejeans117` namespace through the supported GitHub verification flow;
3. configure the repository's publishing identity/credentials in GitHub Actions or the Central-supported publishing mechanism;
4. configure artifact signing according to Central's current requirements;
5. build the canonical standalone renderer before Maven packaging;
6. run `mvn -f adapters/java-spring/pom.xml verify` and inspect the JAR for both renderer assets;
7. publish `0.1.0` and verify its POM, sources, Javadocs and runtime assets from Central before announcing it in the main README.

The documentation must say “prepared for Maven Central publication” until the artifact can actually be resolved from Central.

## Python / PyPI

A future Python package should be a framework adapter/static asset package, not a Python rewrite of the renderer. Candidate integrations can include FastAPI, Flask and Django once the adapter API is defined.

Distribution principles:

- publish to PyPI using the ecosystem's Trusted Publishing/OIDC path from GitHub Actions where available;
- bundle/version the canonical renderer assets and renderer contract in the wheel/sdist;
- expose a small Python API for obtaining/serving a spec and host page;
- test the built wheel, not only the source tree;
- declare renderer-contract compatibility in package metadata/docs;
- choose the PyPI package name only after checking registry availability.

## Rust / crates.io

A future Rust crate should likewise provide framework/server glue and embedded renderer assets. Good targets can be selected later (for example Axum or Actix Web) without creating a separate rendering implementation.

Before implementation, confirm the current crates.io authentication/publishing mechanism and package-name availability. CI should build the crate/package, verify embedded renderer assets, and test installation from the produced package before release.

## Go modules

Go does not require uploading an artifact to a central package registry. A Go adapter should be a normal Go module and use semantic Git tags; `pkg.go.dev` can index the public module.

If the Go module is kept in a subdirectory of this monorepo, its module path and Git tag must follow Go's submodule tag convention. The renderer JS/CSS can be compiled into the module with `go:embed`, keeping deployments self-contained.

Before the first Go release, choose whether the adapter should remain a monorepo submodule or use a dedicated repository. The decision should optimize import-path stability rather than forcing it to match npm/Maven structure.

## Release compatibility checks

Every adapter release should verify at least:

- renderer contract version expected by the adapter;
- exact renderer assets are present in the produced package;
- host HTML loads only local packaged assets by default;
- no documentation-route secret is serialized to the browser;
- basic generated page boots with a representative OpenAPI document;
- package metadata points back to the public FlexDoc source/license;
- no publishing credential or signing secret exists in the produced package.

## Repository boundary

The core FlexDoc repository is intended to remain public. The renderer, OpenAPI engine, local API-client capabilities, CLI/static distribution and framework adapters benefit from being auditable and self-hostable.

If FlexDoc later adds commercial cloud functionality, account/team sync, hosted secret storage, RBAC/SSO, cloud execution, analytics, monitors and billing can live behind a separate service/repository boundary. Registry publication of the open-source adapters should not depend on that commercial service.
