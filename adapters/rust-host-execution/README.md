# prauga-flexdoc-host-execution

Framework-neutral native host-execution engine shared by the Prauga FlexDoc Axum and Actix adapters.

This crate owns the security-sensitive outbound execution contract: exact-origin allowlisting, metadata/link-local blocking, DNS validation and connection pinning, redirect revalidation, header filtering, request/response bounds, and execution deadlines.

Most applications should depend on `prauga-flexdoc-axum` or `prauga-flexdoc-actix`, which re-export the public host-execution types. This package is published separately so both framework adapters consume one audited implementation instead of carrying copied executor source.

## Feature flags

The default `host-execution` feature owns the outbound HTTP stack. Building with `default-features = false` produces a transport-free crate that does not pull in reqwest or its TLS stack; the framework adapters use that mode when native host execution is compiled out.
