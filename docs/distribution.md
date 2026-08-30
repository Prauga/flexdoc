# Distribution and versioning

FlexDoc uses one canonical browser renderer and thin ecosystem adapters. Distribution should preserve that architecture: a Java, Python, Rust, or Go integration packages/serves the version-matched renderer rather than implementing its own OpenAPI renderer.

## Version model

The renderer contract is the compatibility boundary between the shared browser product and language adapters.

| Artifact | Release line | Compatibility |
| --- | --- | --- |
| `@bluejeans/flexdoc-client` | `2.x` | canonical renderer; renderer contract v1 |
| `@bluejeans/flexdoc-backend` | `2.x` | packages the matching 2.x standalone renderer; contract v1 |
| `@bluejeans/flexdoc-cli` | `0.x` initially | consumes a compatible FlexDoc 2.x client and renderer contract v1 |
| Spring Boot starter | `0.1.x` initially | renderer contract v1 / FlexDoc renderer 2.x |
| Python adapter | future independent version | declare supported renderer contract |
| Rust adapter | future independent version | declare supported renderer contract |
| Go adapter | future independent module version | declare supported renderer contract |

Do not synchronize versions across registries merely for aesthetics. Existing npm packages have release history, while new ecosystem artifacts do not. Instead, CI and package documentation must make renderer-contract compatibility explicit.

A breaking renderer-contract change requires a new contract major. An adapter can evolve independently while it continues to consume the same contract.

## Release tags

Registry releases are intentionally scoped by ecosystem/package family so independent versions do not trigger unrelated publishers:

- `js/v<version>` publishes the coordinated npm client/backend release;
- `cli/v<version>` publishes `@bluejeans/flexdoc-cli`;
- `java/v<version>` publishes the Spring Boot adapter to Maven Central.

Future adapters should use an equivalent ecosystem-specific tag family when they gain automated publishing.

## npm

The npm packages are public scoped packages:

- `@bluejeans/flexdoc-client`
- `@bluejeans/flexdoc-backend`
- `@bluejeans/flexdoc-cli`

The client/backend stay on a coordinated `2.x` line because the backend packages the canonical renderer. The CLI has its own `0.x` line and declares a compatible client dependency.

The release workflows use npm Trusted Publishing through GitHub OIDC. No long-lived `NPM_TOKEN` is required after the trusted-publisher relationship exists. The trusted-publisher relationship on npmjs.com must point to the exact GitHub repository and workflow filename for each package.

### Client/backend release policy

1. merge only after client/backend tests, standalone build checks, contract validation, backend asset checks and Java verification are green;
2. create an immutable `js/v<version>` Git tag/GitHub Release;
3. let the client and backend workflows validate that the tag matches the committed package version;
4. inspect the packed artifact before publication;
5. publish using npm Trusted Publishing;
6. never rewrite a registry version. Fixes receive a new patch version.

The two coordinated npm packages should remain on the same 2.x version for now because the backend vendors the canonical client renderer and coordinated versions make that relationship obvious.

### CLI release policy

The CLI uses `.github/workflows/publish-cli.yml` and `cli/v<version>` GitHub Releases.

Before publication the workflow:

1. builds the canonical client renderer used by the CLI;
2. runs the CLI build/serve contract tests;
3. validates the GitHub Release tag exactly matches `tools/flexdoc-cli/package.json`;
4. packs the CLI tarball;
5. installs that tarball into a clean temporary npm consumer;
6. verifies the installed `flexdoc` binary reports the expected version;
7. builds the nested external-reference fixture through the installed tarball and checks the generated static site/bundled spec;
8. switches to the current Trusted-Publishing-capable npm/Node toolchain and publishes through OIDC.

The first npm publication may require a one-time registry-side bootstrap before npm allows configuring Trusted Publishing for the new package. After that bootstrap, configure the Trusted Publisher for:

- repository owner: `bluejeans117`;
- repository: `flexdoc`;
- workflow filename: `publish-cli.yml`;
- publication permission: `npm publish`.

Do not create a GitHub Release for a registry version that was already manually bootstrap-published, because npm package versions are immutable and the workflow would attempt to republish the same version.

## Maven Central / Spring Boot

Coordinates:

```text
io.github.bluejeans117.flexdoc:flexdoc-spring-boot-starter:0.1.0
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

The documentation must say “prepared/configured for Maven Central publication” until the artifact can actually be resolved from Central.

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
