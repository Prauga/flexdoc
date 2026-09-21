# Host-execution observability

FlexDoc host execution is an explicit server-side network path, so operators need visibility into its use without turning request contents or credentials into telemetry.

`@prauga/flexdoc-backend` exposes a stable, deliberately small `flexdoc.execute.*` event contract, optional lifecycle hooks, and a dependency-free operator metric update contract on `tryIt.hostExecution`.

## Lifecycle hooks

```ts
setupFlexDoc(app, '/docs', {
  spec,
  options: {
    tryIt: {
      hostExecution: {
        allowedOrigins: ['https://internal-api.example.test'],
        onHostExecutionStart(event) {
          // event.name === 'flexdoc.execute.start'
          // Correlate in-flight work by event.executionId.
        },
        onHostExecutionComplete(event) {
          // event.name === 'flexdoc.execute.complete'
          // Record duration/outcome/status without request content.
        },
      },
    },
  },
});
```

The hooks are **best effort and non-fatal**. FlexDoc invokes them without waiting for returned promises; a synchronous throw or rejected promise is ignored by the execution path. Synchronous work inside the callback still runs on the application's event loop, so hooks should remain lightweight and hand off expensive export/aggregation work to the application's existing telemetry pipeline. Do not use these hooks for authorization, policy enforcement, billing correctness, or any action that must complete before the request proceeds.

## Event contract

A start event contains only:

- `name: 'flexdoc.execute.start'`;
- opaque `executionId`;
- ISO-8601 `timestamp`;
- supported uppercase HTTP `method` (or `UNKNOWN` for missing/untrusted method metadata).

A completion event carries the same correlation fields plus:

- `durationMs`;
- `outcome: 'success' | 'rejected' | 'error'`;
- optional FlexDoc execute-route `statusCode`;
- optional `reason`, the stable category of a rejection or upstream failure.

The canonical event type has **no URL, target hostname, query string, headers, request body, response body, cookies, certificate material, auth configuration, tokens, or arbitrary metadata bag**. Method metadata is restricted to FlexDoc's supported HTTP verb set; arbitrary method strings collapse to `UNKNOWN` rather than becoming telemetry. Deployment, service, environment, tenant, or fleet labels should be attached by the application/collector outside the FlexDoc event rather than expanding the default OSS payload.

## Outcome semantics

`onHostExecutionStart` fires after the request has the FlexDoc execution marker and a valid execution envelope, immediately before cookie/session resolution and host policy/network execution.

Once a start event is emitted, FlexDoc emits one completion event:

- `success` means FlexDoc completed the host transport and produced a normal execute-route response;
- `rejected` means FlexDoc rejected the validated execution through its request/policy/capability boundary (for example an unapproved target origin);
- `error` means the validated execution failed in the upstream/transport/internal path and the execute route returned a server-side failure.

The completion `statusCode` is the **FlexDoc execute-route status**, not the target API's response status. A target API returning HTTP 404 or 500 can still be a successful host execution: FlexDoc reached the target and returns that target response inside the normal host-execution payload.

Requests rejected before a valid execution exists—for example a missing `X-FlexDoc-Execute: 1` marker or an invalid envelope—do not emit the execution lifecycle pair, because no execution ever began. A missing marker is counted by its own metric instead (see below).

## Reason categories

Rejection messages interpolate request values such as target origins, form-field names and HTTP methods, so they are unbounded and unsafe as aggregation keys. `reason` gives every non-successful execution a stable, low-cardinality category instead:

| Reason | Outcome | Meaning |
|---|---|---|
| `marker-missing` | — | Execute request without `X-FlexDoc-Execute: 1`; never enters the lifecycle. |
| `execution-disabled` | `rejected` | Host execution is switched off for this mount. |
| `admission-saturated` | — | Rejected by admission capacity before lifecycle start. |
| `destination-forbidden` | `rejected` | Target scheme, embedded credentials, allowlist, or link-local/metadata policy. |
| `redirect-forbidden` | `rejected` | Redirect depth exceeded, or a cross-origin redirect. |
| `body-malformed` | `rejected` | Envelope or multipart structure could not be parsed. |
| `body-too-large` | `rejected` | Request exceeded the 32 MiB safety limit. |
| `unsupported-media-type` | `rejected` | Content type was neither JSON nor multipart. |
| `request-invalid` | `rejected` | Envelope parsed but the request was unusable, such as an unsupported method or unknown certificate id. |
| `auth-unsupported` | `rejected` | Requested auth scheme or challenge variant is not implemented. |
| `upstream-timeout` | `error` | Target did not answer within the request timeout. |
| `upstream-unreachable` | `error` | Connection to the target failed at the socket level. |
| `upstream-error` | `error` | Any other failure in the validated upstream path. |

The categories are a closed set. `isHostExecutionReason` validates a value and `hostExecutionReasons` returns them in reporting order.

## Operator metric contract

`onHostExecutionMetric` exposes a stable, low-cardinality update stream without requiring FlexDoc to own a Prometheus registry or add a metrics-client dependency. Bridge the updates into the metrics system already used by the host application.

The contract currently uses these Prometheus-style names:

| Metric | Kind | Meaning |
|---|---|---|
| `flexdoc_execute_requests_total` | counter | Validated host executions that entered the lifecycle. Derive QPS with `rate(...)`/equivalent. |
| `flexdoc_execute_in_flight` | gauge delta | `+1` at validated execution start and `-1` exactly once at completion. |
| `flexdoc_execute_completions_total{outcome}` | counter | Completed executions split only by `success`, `rejected`, or `error`. |
| `flexdoc_execute_rejections_total{source,statusCode,reason}` | counter | Validated route rejections (`400`/`403`) and admission-capacity rejections (`429`), categorized. |
| `flexdoc_execute_errors_total{reason}` | counter | Validated executions that failed upstream, split by timeout, unreachable, or other. |
| `flexdoc_execute_unmarked_total{reason}` | counter | Execute requests missing the marker header. Deliberately outside the lifecycle. |
| `flexdoc_execute_duration_seconds{outcome}` | histogram observation | End-to-end validated host-execution duration in seconds. |

The metric contract intentionally contains **no `executionId`, HTTP method, URL/host, route path, target status, headers, body, credential, user, tenant, or arbitrary label bag**. This keeps the default cardinality bounded and avoids turning operator metrics into a side channel for request data. Applications may add deployment/service identity in their own collector when those labels are already controlled and bounded.

A single sink can be wired to both the execute lifecycle and the admission middleware so `429` is counted even though capacity rejection happens before lifecycle start:

```ts
const onHostExecutionMetric = (update) => {
  // Bridge update.name/kind/value/labels to your existing metrics registry.
};

const admission = createHostExecutionAdmission({ maxInFlight: 32 });
app.use(
  '/docs/__flexdoc/execute',
  createHostExecutionAdmissionMiddleware(admission, { onHostExecutionMetric }),
);

setupFlexDoc(app, '/docs', {
  spec,
  options: {
    tryIt: {
      hostExecution: {
        allowedOrigins: ['https://internal-api.example.test'],
        onHostExecutionMetric,
      },
    },
  },
});
```

`flexdoc_execute_requests_total` starts only after the execution marker and envelope are valid. Admission `429` is therefore represented by the separate rejection counter and is not double-counted as a validated execution. Unmarked requests are counted by `flexdoc_execute_unmarked_total` and move no lifecycle metric: they produced no validated envelope, so counting them as executions would report work that never happened and would let unvalidated traffic distort execution rates. Malformed pre-envelope requests remain HTTP/access-layer signals.

## Aggregate observation export

Bridging to Prometheus is the right answer for a deployment that already runs one. Where no metrics stack exists — or where a post-release review needs a single artifact rather than a live scrape — `createHostExecutionObservationRecorder` aggregates the same metric updates in-process, and `createHostExecutionObservationReport` turns a snapshot into a stable document.

```ts
const recorder = createHostExecutionObservationRecorder();

setupFlexDoc(app, '/docs', {
  spec,
  options: { tryIt: { hostExecution: { allowedOrigins, onHostExecutionMetric: recorder.sink } } },
});

// Whenever an operator asks for evidence:
const report = createHostExecutionObservationReport(recorder.snapshot());
```

The snapshot reports the window bounds, started executions, unmarked requests, completions by outcome, current and peak concurrency, rejection and upstream-failure counts per reason, and the duration distribution as min/p50/p95/p99/max.

Durations are retained up to `durationSampleCapacity` (8192 by default) and then replaced by reservoir sampling, so memory stays bounded on a host that runs indefinitely while percentiles still describe the whole window rather than only its opening. `sampled` says which of the two happened; counts are always exact.

The report carries only counts, timestamps and category names, so it is safe to write to disk or hand to an operator as-is. It also declares what an API host structurally cannot observe: browser-direct executions never reach the host, so the browser / API-host / host-required transport mix cannot be derived here, and the document says so in `gaps` rather than omitting it silently. FlexDoc neither writes nor transmits this document; producing and storing it is entirely the application's decision.

## Native adapters

The contract above is not Node-specific. Each native executor emits the same metric names, the same labels and the same reason vocabulary, and exports the same document schema. Keeping the vocabulary identical is the point: an operator running an Express API host next to a Django or Go one should read one document shape, and a collector written for any runtime should not need a second parser. Every report names its producer in `runtime` and otherwise matches field for field, including the declared `browser-direct-transport-mix` gap.

Python:

```python
from prauga_flexdoc import (
    FlexDocHostExecution,
    FlexDocHostExecutionObservation,
    create_host_execution_observation_report,
)

observation = FlexDocHostExecutionObservation()
executor = FlexDocHostExecution(allowed_origins, metric_sink=observation.record)

report = create_host_execution_observation_report(observation)
```

Go, where the recorder is mutex-guarded so it can be the sink for concurrent handlers directly:

```go
observation := flexdoc.NewHostExecutionObservation()
executor, err := flexdoc.NewHostExecution(allowedOrigins, flexdoc.WithMetricSink(observation.Record))

report := flexdoc.NewHostExecutionObservationReport(observation)
```

Rust, where the shared `prauga-flexdoc-host-execution` crate carries the contract for both the Axum and Actix adapters:

```rust
let observation = HostExecutionObservation::new();
let executor = HostExecution::new(allowed_origins)?.with_metric_sink(observation.sink());

let report = observation_report(&observation);
```

Ruby, where the recorder is mutex-guarded and each worker of a forking server keeps its own window:

```ruby
observation = Prauga::FlexDoc::HostExecutionObservation.new
executor = Prauga::FlexDoc::HostExecution.new(allowed_origins:, metric_sink: observation.sink)

report = Prauga::FlexDoc.host_execution_observation_report(observation)
```

PHP, Elixir, .NET and Java do not emit this evidence yet. Until they do, a host-execution review of a fleet running those adapters has no aggregate to read, which is a coverage gap rather than a claim of clean operation.

## The browser half: transport mix

The gap the host document declares is closed from the browser, not the host. A browser-direct request goes straight from the tab to the target API, so no amount of host instrumentation can count it. `@prauga/flexdoc-client` therefore keeps a matching aggregate for the executions it performs:

```ts
import { apiClientTransportObservation, createApiClientTransportReport } from '@prauga/flexdoc-client';

const report = createApiClientTransportReport(apiClientTransportObservation());
```

Every API Client and Try It execution is recorded through one choke point, so the aggregate counts failure paths as well as successes. Per transport it reports attempts, responses, failures, browser network/CORS failures, responses by status class, and duration percentiles. Executions that never reached a transport are counted separately under `unexecuted` as `host-unavailable`, `script-error` or `request-invalid`, which keeps a blocked request from being mistaken for a transport that misbehaved.

API-host executions carry three duration series rather than one:

| Series | Meaning |
| --- | --- |
| `totalDurations` | Elapsed time observed in the browser, including the hop to the API host |
| `targetDurations` | The host's own measurement of the target request |
| `hostOverhead` | `totalDurations` minus `targetDurations`, the cost of routing through the host |

Keeping them separate is what makes a slow API-host execution attributable. A high target time means the upstream API is slow and moving the request to the browser would not help; a high overhead means the hop to the host is the cost, which is the only case where browser transport is genuinely faster advice. This is the same decomposition the response viewer already shows as "Host" and "Target" for a single request, aggregated across a window.

Operators reach it without writing code from the API Client history panel, where **Transport observation** copies the report and resets the window. The document is aggregate-only, is produced on operator action, and is never transmitted by FlexDoc.

The two halves are deliberately separate documents rather than one merged file, because they are produced by different processes with different lifetimes. Each names the other: the browser report carries `pairsWith: 'flexdoc.host-execution.observation/1'` and declares `host-side-rejection-reasons` in its own `gaps`. Read together they cover a review; read alone, each says what it is missing.

Metric delivery follows the same safety rule as lifecycle hooks: it is **best effort and non-fatal**. Returned promises are not awaited, synchronous throws/rejections are ignored by the request path, and synchronous collector work still runs inline. Keep the sink short and delegate expensive export work to the application's normal telemetry path.

FlexDoc does not export these events or metrics to Prauga or any hosted service. The hooks and metric sink run only inside the customer's application process and remain entirely application-controlled.
