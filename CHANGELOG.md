# Changelog

Notable FlexDoc product releases are recorded here. Detailed release notes remain under `docs/releases/` and are linked from each entry.

## 3.3.0 — backend host execution expansion

FlexDoc 3.3 expands native API-host execution across the supported backend/runtime families, hardens the outbound security boundary, adds server-controlled interactive host-routing preference, and introduces permanent cross-runtime host-impact regression monitoring.

Key release themes:

- native host execution for the supported Java/JVM, Python, Go, .NET, Rust, Ruby, Elixir, and PHP integrations;
- exact-origin allowlisting, metadata/link-local blocking, validated-address connection pinning, redirect revalidation, proxy bypass, header/MIME validation, request/response bounds, and execution deadlines;
- browser Try It routing that can prefer the API host while reusable/headless collection execution remains direct by default;
- release-candidate performance guardrails, canonical embedded-renderer parity, and framework/security conformance coverage;
- `@prauga/flexdoc-client` and `@prauga/flexdoc-backend` version `3.3.0`; native adapters continue their documented independent ecosystem version tracks.

See [`docs/releases/3.3.md`](docs/releases/3.3.md) for the complete behavior, security, deployment, compatibility, and performance notes.
