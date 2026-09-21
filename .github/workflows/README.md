# FlexDoc GitHub workflows

FlexDoc uses separate release tags for each ecosystem while sharing one canonical renderer and renderer contract.

| Workflow | Tag family | Artifact |
| --- | --- | --- |
| `publish-client.yml` | `js/v<version>` | `@prauga/flexdoc-client` + renderer bundle |
| `publish-backend.yml` | `js/v<version>` | `@prauga/flexdoc-backend` |
| `publish-core.yml` | `core/v<version>` | `@prauga/flexdoc-core` |
| `publish-cli.yml` | `cli/v<version>` | `@prauga/flexdoc-cli` |
| `publish-java.yml` | `java/v<version>` | `com.prauga.flexdoc:flexdoc-spring-boot-starter` |
| `publish-python.yml` | `python/v<version>` | `prauga-flexdoc` on PyPI |
| `publish-rust.yml` | `rust/v<version>` | `prauga-flexdoc-axum` on crates.io |
| `release-go.yml` | `adapters/go/v<version>` | public Go submodule tag |

`ci.yml` and `e2e.yml` validate normal pull requests. They build the canonical renderer, verify packed npm consumption, byte-check the committed Go/Python/Rust renderer assets, build ecosystem packages, and exercise browser behavior.

## Authentication

Long-lived registry credentials are avoided where the registry supports OIDC:

- npm packages use npm Trusted Publishing and require `id-token: write`.
- PyPI uses `pypa/gh-action-pypi-publish` with a Trusted Publisher.
- crates.io uses `rust-lang/crates-io-auth-action` with a Trusted Publisher.
- Maven Central uses the Central credentials and signing key already expected by `publish-java.yml`.
- Go requires no registry credential; the versioned submodule tag is the release.

Trusted Publisher relationships are registry-side configuration. They must point at the `Prauga/flexdoc` repository and the exact workflow filenames above.

Legacy `@bluejeans/*` npm packages are not published by these workflows. Owners deprecate them out of band with `npm deprecate` after the matching `@prauga/*` packages are publicly installable; that runbook is not kept in this public repository.
