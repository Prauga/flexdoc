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
- optional FlexDoc execute-route `statusCode`.

The canonical event type has **no URL, target hostname, query string, headers, request body, response body, cookies, certificate material, auth configuration, tokens, or arbitrary metadata bag**. Method metadata is restricted to FlexDoc's supported HTTP verb set; arbitrary method strings collapse to `UNKNOWN` rather than becoming telemetry. Deployment, service, environment, tenant, or fleet labels should be attached by the application/collector outside the FlexDoc event rather than expanding the default OSS payload.

## Outcome semantics

`onHostExecutionStart` fires after the request has the FlexDoc execution marker and a valid execution envelope, immediately before cookie/session resolution and host policy/network execution.

Once a start event is emitted, FlexDoc emits one completion event:

- `success` means FlexDoc completed the host transport and produced a normal execute-route response;
- `rejected` means FlexDoc rejected the validated execution through its request/policy/capability boundary (for example an unapproved target origin);
- `error` means the validated execution failed in the upstream/transport/internal path and the execute route returned a server-side failure.

The completion `statusCode` is the **FlexDoc execute-route status**, not the target API's response status. A target API returning HTTP 404 or 500 can still be a successful host execution: FlexDoc reached the target and returns that target response inside the normal host-execution payload.

Requests rejected before a valid execution exists—for example a missing `X-FlexDoc-Execute: 1` marker or an invalid envelope—do not emit the execution lifecycle pair. HTTP/access-layer monitoring can count those route-level rejections separately.

## Operator metric contract

`onHostExecutionMetric` exposes a stable, low-cardinality update stream without requiring FlexDoc to own a Prometheus registry or add a metrics-client dependency. Bridge the updates into the metrics system already used by the host application.

The contract currently uses these Prometheus-style names:

| Metric | Kind | Meaning |
|---|---|---|
| `flexdoc_execute_requests_total` | counter | Validated host executions that entered the lifecycle. Derive QPS with `rate(...)`/equivalent. |
| `flexdoc_execute_in_flight` | gauge delta | `+1` at validated execution start and `-1` exactly once at completion. |
| `flexdoc_execute_completions_total{outcome}` | counter | Completed executions split only by `success`, `rejected`, or `error`. |
| `flexdoc_execute_rejections_total{source,statusCode}` | counter | Validated route rejections (`400`/`403`) and admission-capacity rejections (`429`). |
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

`flexdoc_execute_requests_total` starts only after the execution marker and envelope are valid. Admission `429` is therefore represented by the separate rejection counter and is not double-counted as a validated execution. Missing markers and malformed pre-envelope requests remain HTTP/access-layer signals rather than lifecycle metrics.

Metric delivery follows the same safety rule as lifecycle hooks: it is **best effort and non-fatal**. Returned promises are not awaited, synchronous throws/rejections are ignored by the request path, and synchronous collector work still runs inline. Keep the sink short and delegate expensive export work to the application's normal telemetry path.

FlexDoc does not export these events or metrics to Prauga or any hosted service. The hooks and metric sink run only inside the customer's application process and remain entirely application-controlled.
