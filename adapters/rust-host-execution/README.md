# prauga-flexdoc-host-execution

Framework-neutral native host-execution engine shared by the Prauga FlexDoc Axum and Actix adapters.

This crate owns the security-sensitive outbound execution contract: exact-origin allowlisting, metadata/link-local blocking, DNS validation and connection pinning, redirect revalidation, header filtering, request/response bounds, and execution deadlines.

Most applications should depend on `prauga-flexdoc-axum` or `prauga-flexdoc-actix`, which re-export the public host-execution types. This package is published separately so both framework adapters consume one audited implementation instead of carrying copied executor source.


## Cargo feature

Native transport is enabled by default through the `native-host-execution` feature. Consumers that only need renderer hosting can compile without the executor stack:

```bash
cargo check --no-default-features
```

With that feature disabled, executor-specific exports are not available and reqwest/TLS/DNS transport dependencies are not activated.
