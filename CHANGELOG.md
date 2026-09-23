# Changelog

Notable FlexDoc product releases are recorded here. Detailed release notes remain under `docs/releases/` and are linked from each entry.

## Unreleased

## Java 0.11.0 and ASP.NET Core 0.8.0

The Java family moves to **0.11.0**. `Prauga.FlexDoc.AspNetCore` moves to **0.8.0**. Client, backend, CLI, and the other native lines stay on their current releases.

- Spring MVC and ASP.NET Core emit the same runtime-contract validation object as Node. A complete-discovery undocumented route fails `flexdoc validate` by method and path. Acknowledgement keeps that route registered as informational and does not remove it from the runtime record. Snapshot membership uses the same wire identity as validation, so differing path-parameter names are one operation.

## 3.5.0 — Node disagreement loop

`@prauga/flexdoc-client` and `@prauga/flexdoc-backend` **3.5.0**, with `@prauga/flexdoc-cli` **0.8.0**. Native adapter versions are unchanged.

**Behavior change.** The 3.x line is not strict SemVer. `^3.4.0` can resolve to 3.5.0, and a service that previously passed validation with only an undocumented-route warning now fails the default check.

**Licensing.** This release publishes the client, backend, and CLI under Apache-2.0. The 3.4.0 client and backend packages, and CLI 0.7.0, recorded `AGPL-3.0-or-later`. The new license applies to these artifacts and does not replace tarballs already on the registry.

- An implemented route that OpenAPI does not document fails `flexdoc validate` when runtime discovery is complete, and the failure names the method and path. Partial discovery keeps that finding a warning.
- `runtimeIntelligence.acknowledgedUndocumented` records a chosen route as acknowledged info. The route stays registered, `summary.runtime` still counts it, and the acknowledgement does not fail validation.
- Opening that finding shows the missing contract beside the registered method and path, and can send it from the API Client. The URL uses the snapshot `serverOrigin` when present, and is same-origin otherwise. The request asks to prefer the API host only when host execution is available and the server has not opted out.

See [`docs/releases/3.5.0.md`](docs/releases/3.5.0.md).

## 3.4.0 — 3.3.x hardening package release

Package semver is independent from internal product-milestone labels: **3.4.0** publishes the completed 3.3.x hardening stack.

Key release themes:

- horizontally scaled Node host execution with shared session state, honest capability degradation, fleet admission budgeting, fleet-readable observation merge and deployment recipes;
- the same OBS-07 execution-evidence vocabulary and export shape across all nine native executing runtimes;
- coordinated `@prauga/flexdoc-client` / `@prauga/flexdoc-backend` **3.4.0**, with independently versioned native feature-minor releases;
- `runHostCookiesRoute` is now asynchronous for remote session stores; in-repo callers already await it, while external direct callers of the undocumented low-level export must do the same.

See [`docs/releases/3.4.0.md`](docs/releases/3.4.0.md) for the complete package, compatibility, multi-instance and release-sequencing notes.

## 3.3.0 — backend host execution expansion

FlexDoc 3.3 expands native API-host execution across the supported backend/runtime families, hardens the outbound security boundary, adds server-controlled interactive host-routing preference, and introduces permanent cross-runtime host-impact regression monitoring.

Key release themes:

- native host execution for the supported Java/JVM, Python, Go, .NET, Rust, Ruby, Elixir, and PHP integrations;
- exact-origin allowlisting, metadata/link-local blocking, validated-address connection pinning, redirect revalidation, proxy bypass, header/MIME validation, request/response bounds, and execution deadlines;
- browser Try It routing that can prefer the API host while reusable/headless collection execution remains direct by default;
- release-candidate performance guardrails, canonical embedded-renderer parity, and framework/security conformance coverage;
- `@prauga/flexdoc-client` and `@prauga/flexdoc-backend` version `3.3.0`; native adapters continue their documented independent ecosystem version tracks.

See [`docs/releases/3.3.md`](docs/releases/3.3.md) for the complete behavior, security, deployment, compatibility, and performance notes.
