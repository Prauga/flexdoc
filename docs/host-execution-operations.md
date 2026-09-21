# API-host execution operations and abuse controls

This guidance is part of the `@prauga/flexdoc-backend` **3.4.0** host-execution contract. FlexDoc API-host execution is an application-owned server capability. When it is available, an interactive browser request can become two network hops: browser -> API host -> target API. The execute endpoint therefore consumes API-host CPU, memory, sockets, outbound bandwidth, DNS/TLS work, and target-service capacity in addition to the ordinary documentation request.

The built-in executor safety policy is necessary but is not an application abuse policy. Exact-origin allowlists, DNS/address pinning, redirect validation, request/response size bounds, execution deadlines, and `X-FlexDoc-Execute: 1` prevent classes of unsafe execution; they do not identify the caller or decide how much work one authenticated user may cause.

## Production boundary

For production deployments that enable host execution:

1. Protect the entire documentation subtree, including `POST <docsPath>/__flexdoc/execute`, with the same application authentication and authorization policy. The FlexDoc marker is protocol/cross-site friction, not authentication and not a substitute for CSRF policy.
2. Apply caller-aware rate limits at the application gateway, ingress, or authenticated application layer. Prefer user/session/API-key identity over raw source IP when the deployment has reliable caller identity.
3. Bound concurrent in-flight execute requests. Reject excess work before creating outbound connections or buffering request bodies when possible.
4. Return an explicit overload response such as HTTP `429 Too Many Requests` with a short `Retry-After`, or the deployment's standard `503 Service Unavailable` response. Do not queue unbounded work in application memory.
5. Keep FlexDoc's request, response, redirect, and timeout bounds enabled. Application or ingress limits may be lower than FlexDoc's canonical maxima.
6. Observe the execute route separately from ordinary documentation traffic. At minimum track request rate, in-flight count, rejections, p95/p99 duration, timeout/upstream-error rate, request/response sizes, and outbound connection/egress pressure.

A multi-instance deployment should normally enforce user-aware rate limits in a shared gateway or distributed limiter. The small in-process helpers below are admission-control backstops for one process; they are not distributed quotas.

### Explicit protection acknowledgements

FlexDoc 3.3.x makes the application-owned auth boundary explicit before these native adapters expose a real execute endpoint:

- Spring Boot: set `flexdoc.host-execution-protected=true` only after Spring Security or the deployment gateway protects the docs/execute paths.
- JAX-RS/shared JVM: set `FlexDocConfig.builder().hostExecutionProtected(true)` only after the Jakarta/application-server/gateway policy protects the resource.
- ASP.NET Core: set `options.HostExecutionProtected = true` only after the application authorization boundary protects both the docs shell and docs subtree.

These switches are **acknowledgements, not authentication mechanisms**. They do not install auth, authorize a caller, or replace CSRF policy. Spring/JAX-RS JVM host construction and ASP.NET Core route mapping fail closed when a real native executor is attached without the corresponding acknowledgement. A protocol advertisement with no real executor can still remain unavailable without the acknowledgement.

### Ordinary-request routing knob

When native host execution must remain enabled but operators do not want ordinary interactive Try It requests to take the additional browser -> API-host -> target hop, the Node host can set `tryIt.hostExecution.preferHostExecution: false`. Host-only features still require host execution; this knob only keeps ordinary requests on direct browser transport. Omitting the option keeps the 3.3 default (`true`).

## Execute-route failure diagnostics

FlexDoc does **not** probe the API-host execute route before a normal request. The interactive API Client and Try It surface send the real request first. Only after an actual API-host transport attempt fails may the browser issue a supplemental diagnostic POST to the same configured execute endpoint.

The diagnostic request deliberately sends an empty JSON envelope (`{}`) with the FlexDoc protocol marker. It does not contain the failed target URL, target headers, target body, API credentials, signing material, or other target secrets. Same-origin documentation credentials may still be included by the browser so the probe crosses the same application authentication boundary as the execute route.

Diagnostic results are supplemental; the original execution failure remains authoritative:

- FlexDoc's canonical `400` validation response, or admission-control `429`, confirms that the execute route is reachable. No extra warning is added, and recognized routes may be cached for the browser page lifetime.
- `404`, `501`, or `405` without `POST` in `Allow` indicates that the configured endpoint does not expose the FlexDoc execute route; the UI adds deployment/URL guidance.
- `401` and `403` add authentication, authorization, same-origin, or CSRF guidance.
- An unexpected successful response warns that the configured endpoint may not be FlexDoc's hardened execute route.
- A generic middleware `400` is not treated as proof of the FlexDoc route and adds request-body/CSRF guidance.
- A diagnostic network failure does not replace or obscure the original execution error.
- Cancellation stops the flow without starting a new diagnostic when the request was already aborted. If cancellation happens during the diagnostic, the interactive API Client reports the request as cancelled.

Direct browser execution is unaffected by these diagnostics, and successful API-host requests incur no diagnostic request or extra network hop.

## Node / Express / Nest reference admission control

`@prauga/flexdoc-backend` exports `createHostExecutionAdmission` and `createHostExecutionAdmissionMiddleware`. Register application authentication first, then any CSRF/same-origin policy, then the admission middleware, then mount FlexDoc. The middleware limits only the execute route and releases the process-local slot once on response finish/close or synchronous downstream failure.

```ts
import express from 'express';
import {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  setupExpressFlexDoc,
} from '@prauga/flexdoc-backend';

const app = express();
const hostExecutionAdmission = createHostExecutionAdmission({ maxInFlight: 16 });

// Application-owned identity and CSRF policy belong before FlexDoc.
app.use('/docs', requireDocumentationUser);
app.use('/docs/__flexdoc/execute', requireSameOriginOrCsrfToken);
app.use(
  '/docs/__flexdoc/execute',
  createHostExecutionAdmissionMiddleware(hostExecutionAdmission, { retryAfterSeconds: 1 }),
);

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    tryIt: {
      hostExecution: {
        allowedOrigins: ['https://api.internal.example'],
      },
    },
  },
});
```

The same middleware shape works with Nest when mounted on the underlying Express adapter before `setupNestFlexDoc`. Use the framework or ingress rate limiter already standard in the application for quotas such as requests per authenticated user per minute. A distributed Express/Nest deployment should not use the process-local admission controller as its only rate limit.

## Spring reference admission control

The Spring starter auto-registers `FlexDocHostExecutionAdmissionFilter` for the normalized execute route whenever native host execution is enabled. The shared JVM transport has its own finite worker and queue bounds as a final resource-safety layer, but applications should reject overload earlier at the HTTP boundary. The registration runs late in the servlet filter chain so Spring Security and ordinary application authentication/CSRF filters can run first. After that boundary exists, set `flexdoc.host-execution-protected=true` before enabling the real executor.

Configure the process-local ceiling directly on the starter:

```yaml
flexdoc:
  host-execution-max-in-flight: 16
  host-execution-retry-after-seconds: 1
```

The starter derives the execute mapping from normalized `flexdoc.path`. The filter returns HTTP `429` with `Retry-After` immediately when its local in-flight bound is saturated and releases capacity in a `finally` block after downstream completion or failure.

For a multi-instance Spring deployment, use the gateway or the application's existing distributed rate limiter for per-user quotas and keep the filter as a local in-flight backstop. The JVM executor itself currently uses a bounded host-execution worker pool (**64 workers with a finite 256-request queue**) and a bounded Apache connection pool. Those internal bounds prevent unbounded executor growth; they are deliberately not exposed as caller quotas because only the surrounding application knows who the caller is and which users should share limits.

## Security-suite discovery

HTTP-boundary host-execution security suites use one cross-runtime naming stem: `HostExecutionHttpSecurity` (or the ecosystem's snake_case equivalent). A maintainer can discover one HTTP-boundary suite per supported adapter family with:

```sh
find adapters -type f | grep -Ei 'host[_A-Za-z]*execution[_A-Za-z]*http[_A-Za-z]*security'
```

Lower-level executor/policy tests may continue to use broader `host_execution_security` naming; the `http` stem is reserved for framework/route-boundary conformance.

## Running more than one instance

FlexDoc holds host-execution session state in the process that serves the request. On one instance that is correct. Behind a load balancer it is not, and the failure is quiet rather than loud, so it is worth stating plainly.

The FlexDoc session cookie is an opaque id with an HMAC appended. By default the signing secret is random per process, so an instance cannot verify a cookie another instance issued — and a cookie it cannot verify is indistinguishable from a forged one, so it correctly discards it, mints a new session and allocates an empty cookie jar. Without session affinity that is the normal path, not the exceptional one: a flow that authenticates and then calls an endpoint needing the resulting cookie passes when consecutive requests land on the same instance and fails when they do not, with nothing in the error pointing at the topology.

Give every instance the same secret and a shared jar store:

```ts
flexdoc(app, {
  spec,
  tryIt: {
    hostExecution: {
      enabled: true,
      allowedOrigins: ['https://api.example.com'],
      instances: 'multiple',
      sessionSecret: process.env.FLEXDOC_SESSION_SECRET,
      sessionStore: {
        async read(sessionId) { return JSON.parse((await redis.get(`flexdoc:${sessionId}`)) ?? 'null') ?? undefined; },
        async write(sessionId, cookies) { await redis.set(`flexdoc:${sessionId}`, JSON.stringify(cookies), { EX: 3600 }); },
        async clear(sessionId) { await redis.del(`flexdoc:${sessionId}`); },
      },
    },
  },
});
```

FlexDoc defines the interface; the application supplies the implementation it already runs. No Redis or database dependency enters the package, and the default stays the in-process store, so a single-instance deployment needs no configuration and gains no new failure mode.

A shared jar store contains third-party session cookies and must be operated as credential storage: keep entries short-lived, use the backing store's normal encryption-at-rest controls, and never log serialized cookie values. The application should not copy jar contents into metrics, traces, request logs, or support dumps. When a workspace credential scope moves to `never` or credentials are cleared, call the host cookies clear route so the shared store does not outlive the user's revocation.

`sessionSecret` must be at least 32 bytes and is rejected at startup otherwise. A weak shared secret is worse than the random default: it looks like multi-instance support while making session cookies forgeable.

Declaring `instances: 'multiple'` is what turns a silent misbehaviour into a stated one. In that mode, if either the secret or the store is missing, FlexDoc **stops advertising the `cookies` capability**, logs which piece is absent, and the renderer shows the honest transport state instead of offering a jar that will reset. Withdrawing a capability the deployment cannot honour is the same rule the product applies to every other advertised feature.

Two consequences are worth planning for even when jars are not used, and each now has a helper.

### Sizing admission for the fleet, not the instance

The admission cap is per instance, so a cap of 8 across 4 instances admits up to 32 concurrent executions. The number an operator actually cares about is the second one — it is the load that reaches the API host — so declare it directly and let FlexDoc divide:

```ts
const admission = createHostExecutionAdmission({ fleetMaxInFlight: 32, instances: 4 });

admission.maxInFlight;         // 8, this instance's share
admission.budget.unallocated;  // capacity lost to integer division, held by nobody
```

`maxInFlight` and `fleetMaxInFlight` cannot both be set, since they are the same limit at two scopes, and `instances` without `fleetMaxInFlight` is rejected rather than ignored: silently ignoring it would leave an operator believing a fleet bound is in force while every instance admits the full per-instance cap. A fleet budget below the instance count is also rejected, because rounding up would exceed the budget that was asked for and rounding down would admit nothing.

The division is static. FlexDoc deliberately does not coordinate admission through a shared counter: that would put a network dependency in front of a privileged endpoint, and when the coordinator is unreachable every request has to either fail open, abandoning the bound that justified the controller, or fail closed, turning a coordinator outage into a FlexDoc outage. Static partitioning has neither failure mode and costs no round-trip. What it gives up is borrowing — a busy instance cannot use an idle instance's share — so size the fleet budget against the API host's real tolerance and let per-user quotas live at the gateway, where the caller is known.

### Reading observability across the fleet

Each process aggregates its own window, so one export describes one instance, and there is no safe way to tell which fraction of the fleet's traffic it saw. Collect one document per instance and merge them:

```ts
const fleet = mergeHostExecutionObservationDocuments(
  await Promise.all(instanceUrls.map(async (url) => (await fetch(url)).json())),
);

fleet.totals.rejectionsByReason;              // exact
fleet.concurrency.peakInFlightUpperBound;     // a bound, not an observation
fleet.durations?.percentiles;                 // null with two or more instances
fleet.durations?.p95SpreadMs;                 // which instances disagree, and by how much
```

Collecting the documents stays the application's job, exactly as with the session store and the metric sink; FlexDoc adds no transport. What the merge adds is honesty about which parts of the result are exact:

- **Counts are additive and stay exact.** Started, unmarked and completed executions, outcomes, and both reason breakdowns simply add.
- **Concurrency is a bound.** Two instances each peaking at 8 may never have peaked together, so the sum is reported as `peakInFlightUpperBound`, alongside the exact `peakInFlightSingleInstanceMax`. There is no `peakInFlight` field to misread.
- **Percentiles are not merged.** A percentile cannot be recovered from other percentiles, and the retained samples do not travel in the per-instance documents. With two or more instances `percentiles` is null, the merge reports the exact fleet minimum and maximum plus every per-instance summary, and `cross-instance-duration-percentiles` joins the declared gaps. With a single instance the percentiles are that instance's own and are passed through with no disclaimer.
- **An empty merge is an error, not a clean fleet.** A collection failure that returned nothing would otherwise report a healthy fleet of zero executions, and a document from an unrecognized schema is rejected by name rather than silently folded into the totals.

For Compose, Kubernetes and plain load-balanced topologies, plus the checks that prove a fleet is actually configured rather than assumed, see [multi-instance deployment](./multi-instance-deployment.md).

**Session affinity is the interim answer, not the answer.** Sticky sessions fix the symptom today with no code change. They also redistribute users on scale-down and rolling deploys, which resets jars exactly when a deployment is already changing behaviour, and they constrain load balancing to work around a product limitation. Use affinity until the secret and store are in place; do not treat it as the destination.

## CSRF and cross-site requests

Authentication and rate limiting do not replace CSRF policy. If the application uses cookie-authenticated documentation, either include the execute endpoint in the application's normal CSRF-token mechanism or narrowly exempt that one endpoint only when another same-origin/application control is intentionally used. Never disable CSRF globally just to enable FlexDoc.

`X-FlexDoc-Execute: 1` is still required by the protocol, but applications must not treat possession of that header as proof of authorization.

## Operational signals

Useful route-level metrics include:

- accepted and rejected execute requests;
- current and peak in-flight requests;
- `429`, timeout, DNS/policy, target `4xx/5xx`, and transport-error counts;
- p50/p95/p99 execute duration and target response time;
- inbound envelope and returned response sizes;
- outbound connection creation/reuse and socket exhaustion signals where the runtime exposes them;
- host CPU, RSS/PSS, and outbound bytes while execute traffic is active.

FlexDoc's permanent host-impact benchmark is a synthetic release regression control, not a substitute for production telemetry. Production limits should be sized from the application's expected documentation audience, target-service capacity, and existing security/traffic policy.
