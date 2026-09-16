# Host-execution observability

FlexDoc host execution is an explicit server-side network path, so operators need visibility into its use without turning request contents or credentials into telemetry.

`@prauga/flexdoc-backend` exposes a stable, deliberately small `flexdoc.execute.*` event contract and optional lifecycle hooks on `tryIt.hostExecution`.

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

The hooks are **best effort, non-blocking, and non-fatal**. FlexDoc invokes them without waiting for returned promises. A synchronous throw or rejected promise is ignored by the execution path. Do not use these hooks for authorization, policy enforcement, billing correctness, or any action that must complete before the request proceeds.

## Event contract

A start event contains only:

- `name: 'flexdoc.execute.start'`;
- opaque `executionId`;
- ISO-8601 `timestamp`;
- uppercase HTTP `method` (or `UNKNOWN`).

A completion event carries the same correlation fields plus:

- `durationMs`;
- `outcome: 'success' | 'rejected' | 'error'`;
- optional FlexDoc execute-route `statusCode`.

The canonical event type has **no URL, target hostname, query string, headers, request body, response body, cookies, certificate material, auth configuration, tokens, or arbitrary metadata bag**. This is intentional. Deployment, service, environment, tenant, or fleet labels should be attached by the application/collector outside the FlexDoc event rather than expanding the default OSS payload.

## Outcome semantics

`onHostExecutionStart` fires after the request has the FlexDoc execution marker and a valid execution envelope, immediately before cookie/session resolution and host policy/network execution.

Once a start event is emitted, FlexDoc emits one completion event:

- `success` means FlexDoc completed the host transport and produced a normal execute-route response;
- `rejected` means FlexDoc rejected the validated execution through its request/policy/capability boundary (for example an unapproved target origin);
- `error` means the validated execution failed in the upstream/transport/internal path and the execute route returned a server-side failure.

The completion `statusCode` is the **FlexDoc execute-route status**, not the target API's response status. A target API returning HTTP 404 or 500 can still be a successful host execution: FlexDoc reached the target and returns that target response inside the normal host-execution payload.

Requests rejected before a valid execution exists—for example a missing `X-FlexDoc-Execute: 1` marker or an invalid envelope—do not emit the execution lifecycle pair. HTTP/access-layer monitoring can count those route-level rejections separately.

## Metrics integration

Keep metric labels low-cardinality. `outcome` and execute-route status class are suitable dimensions; `executionId` is for correlation and should not become a metric label.

```ts
hostExecution: {
  allowedOrigins: ['https://internal-api.example.test'],
  onHostExecutionStart() {
    hostExecutionInFlight.inc();
  },
  onHostExecutionComplete(event) {
    hostExecutionInFlight.dec();
    hostExecutionTotal.inc({ outcome: event.outcome });
    hostExecutionDuration.observe(event.durationMs / 1000);
  },
}
```

FlexDoc does not export these events to Prauga or any hosted service. The hooks run only inside the customer's application process and remain entirely application-controlled.
