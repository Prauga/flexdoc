# Prauga FlexDoc JVM host

`com.prauga.flexdoc:flexdoc-jvm` is the framework-neutral Java 17+ host for FlexDoc. It owns the HTML bootstrap, renderer fingerprinting, cache policy, embedded canonical JS/CSS, and the framework-neutral native host-execution engine. It has no Spring, Jakarta REST, servlet, Guice, or application-server dependency.

```java
FlexDocHost host = new FlexDocHost(
    FlexDocConfig.builder()
        .path("/docs")
        .specUrl("/openapi.json")
        .title("My API")
        .build());
```

The builder also exposes `expand(...)` or `expandSections(...)`, `tryItDefaultServer(...)`, `tryItCredentials(...)`, and `tryItApiClientPersistenceKey(...)`; the persistence key may be a string or `false`, and unset fields are omitted from `window.__FLEXDOC_OPTIONS__`.

An HTTP framework maps `documentation()`, `rendererJavaScript()`, and `rendererCss()` from the host. A framework that advertises native host execution must additionally own and protect its execute HTTP boundary; the JVM library deliberately does not install an unauthenticated server route on its own.

## Native host execution

`FlexDocHostExecution` is the reusable Java executor used by the Spring and JAX-RS bindings. It requires a non-empty exact HTTP(S) origin allowlist, validates every outbound hop, blocks link-local/cloud-metadata destinations, rejects cross-origin redirects and unsafe transport headers, and pins Apache HttpClient resolution to the freshly validated address set while retaining the original hostname for HTTP authority, SNI and certificate verification.

The framework-owned execute endpoint uses the canonical protocol:

```text
POST <docsPath>/__flexdoc/execute
X-FlexDoc-Execute: 1
```

`X-FlexDoc-Execute: 1` is a protocol marker and cross-site friction. **It is not authentication and it is not a CSRF token.** Put the documentation subtree and execute POST behind the application's normal authentication/authorization boundary and configure CSRF deliberately when cookie authentication is used.

The first JVM native slice advertises `capabilities: []`. That means ordinary host transport is available while cookie jars, client certificates, Digest, Hawk, OAuth 1.0 and SigV4 remain unsupported and fail closed; an empty list does not mean the execute route is disabled.

### Resource limits and production tuning

The shared pinned Apache client is intentionally bounded:

- at most **64** concurrent FlexDoc transport workers;
- at most **256** additional queued executions before overload is rejected;
- the Apache connection manager is capped at **256 total** and **256 per route** connections;
- pooled connections have a **30 second** time-to-live and are revalidated after **2 seconds** of inactivity;
- connection acquisition, connect/socket work and the overall executor future remain covered by the canonical request deadline;
- changed DNS pin sets use a different HttpClient user token, so a socket created for an earlier validated address set cannot be reused after rebinding.

The worker/queue values are internal **last-resort safety ceilings**, not recommended request concurrency. When all 64 workers and all 256 queue slots are occupied, the next transport submission is rejected promptly as `IOException: Host execution transport capacity exceeded.` rather than waiting indefinitely or creating another worker/queue structure. The repository has a saturation regression that fills both bounds and proves that failure mode.

Production HTTP admission should normally be **materially lower** than the transport ceiling so overload is rejected before request parsing, DNS/TLS work, or queue residence. For a typical Spring deployment, start with an application-owned per-process execute limit such as **16 concurrent requests**, measure target latency/CPU/socket pressure, and adjust from production telemetry. Keep caller-aware quotas at the gateway/application identity layer; a local semaphore is not a distributed user quota.

If the execute route reaches the JVM transport-capacity error, treat it as evidence that the earlier admission boundary is missing, too high, or bypassed. Prefer lowering the HTTP in-flight limit, adding caller-aware throttling, or scaling application replicas before changing the internal transport implementation. The 64/256 values are not exposed as a public tuning knob in 3.3 because changing them also changes thread, queue, connection and timeout pressure that must be profiled together.

For Spring, use `FlexDocHostExecutionAdmissionFilter` on `<docsPath>/__flexdoc/execute`; the Spring starter README and [`docs/host-execution-operations.md`](../../docs/host-execution-operations.md) contain the copy-paste registration pattern. JAX-RS or custom JVM bindings should apply the equivalent application/gateway admission boundary before invoking `FlexDocHostExecution`.

For Guice or Governator-style applications, bind a configured `FlexDocHost` as a singleton and have the application's existing HTTP layer translate `FlexDocHttpResponse` into its native response type. Governator is built around Guice lifecycle/DI, so no renderer-specific Governator integration is required. If that HTTP layer exposes native execution, protect it with the same application security policy as the docs route rather than treating the FlexDoc marker as authorization.
