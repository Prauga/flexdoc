# Changelog

Notable FlexDoc product releases are recorded here. Detailed release notes remain under `docs/releases/` and are linked from each entry.

## Unreleased

- An implemented route that OpenAPI does not document fails `flexdoc validate` when runtime discovery is complete, and the failure names the method and path. Partial discovery keeps that finding a warning. `runtimeIntelligence.acknowledgedUndocumented` records that route as acknowledged info. The route stays registered, `summary.runtime` still counts it, and the acknowledgement does not fail validation.
- Opening that finding shows the missing contract beside the registered method and path, and can send it from the API Client. The URL uses the snapshot `serverOrigin` when present, and is same-origin otherwise. The request asks to prefer the API host only when host execution is available and the server has not opted out.

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
