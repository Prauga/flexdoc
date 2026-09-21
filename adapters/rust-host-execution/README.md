# prauga-flexdoc-host-execution

Framework-neutral native host-execution engine shared by the Prauga FlexDoc Axum and Actix adapters.

This crate owns the security-sensitive outbound execution contract: exact-origin allowlisting, metadata/link-local blocking, DNS validation and connection pinning, redirect revalidation, header filtering, request/response bounds, and execution deadlines.

Most applications should depend on `prauga-flexdoc-axum` or `prauga-flexdoc-actix`, which re-export the public host-execution types. This package is published separately so both framework adapters consume one audited implementation instead of carrying copied executor source.

## Execution evidence

An executor that reports nothing leaves an operator guessing whether a failing Try It is a policy rejection, a slow upstream or traffic that never carried an execute marker. Attach a metric sink to emit the same metric names, labels and reason vocabulary as the Node, Python and Go hosts, so one collector reads a mixed fleet:

```rust
use prauga_flexdoc_host_execution::{observation_report, HostExecution, HostExecutionObservation};

let observation = HostExecutionObservation::new();
let executor = HostExecution::new(["https://api.example.internal"])?
    .with_metric_sink(observation.sink());

// Whenever an operator asks for evidence:
let report = observation_report(&observation);
```

The sink receives `HostExecutionMetric` values carrying a name, kind, value and labels, and nothing else: no URL, header, body or credential reaches it. Bridge it to Prometheus or OpenTelemetry where such a stack exists; where none does, `HostExecutionObservation` folds the same updates into a mutex-guarded aggregate that clones share, so it can serve concurrent handlers directly, and `observation_report` produces the shared `flexdoc.host-execution.observation/1` document every other runtime also emits.

Every non-successful execution carries one of the stable categories in `HOST_EXECUTION_REASONS`, which is why rejections and upstream failures are separable at all — the human-readable messages interpolate origins and field names, so they are unbounded and unusable as a metric label. Requests arriving without `X-FlexDoc-Execute` are counted by `flexdoc_execute_unmarked_total` and deliberately move no lifecycle metric, since they produced no validated envelope.

The report declares `browser-direct-transport-mix` in its gaps: a browser-direct execution never reaches this process, so the transport mix cannot be derived here. Timestamps and reservoir sampling are implemented without adding dependencies, so nothing here widens what a consumer compiles. Metric delivery is best effort: a sink that panics cannot fail an execution.

## Feature flags

The default `host-execution` feature owns the outbound HTTP stack. Building with `default-features = false` produces a transport-free crate that does not pull in reqwest or its TLS stack; the framework adapters use that mode when native host execution is compiled out.
