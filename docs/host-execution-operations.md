# API-host execution operations and abuse controls

This guidance is part of the `@prauga/flexdoc-backend` **3.3.0** host-execution contract. FlexDoc API-host execution is an application-owned server capability. When it is available, an interactive browser request can become two network hops: browser -> API host -> target API. The execute endpoint therefore consumes API-host CPU, memory, sockets, outbound bandwidth, DNS/TLS work, and target-service capacity in addition to the ordinary documentation request.

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

The Spring starter exports `FlexDocHostExecutionAdmissionFilter`. The shared JVM transport has its own finite worker and queue bounds as a final resource-safety layer, but applications should reject overload earlier at the HTTP boundary. Register the filter only for the execute route and keep Spring Security ahead of it for authentication/authorization.

```java
import com.prauga.flexdoc.spring.FlexDocHostExecutionAdmissionFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

@Bean
FilterRegistrationBean<FlexDocHostExecutionAdmissionFilter> flexDocHostExecutionAdmission() {
  var registration = new FilterRegistrationBean<>(
      new FlexDocHostExecutionAdmissionFilter(16, 1));
  registration.addUrlPatterns("/docs/__flexdoc/execute");
  registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
  return registration;
}
```

Adapt the mapping when `flexdoc.path`, servlet context path, or reverse-proxy path rewriting is customized. The filter returns HTTP `429` with `Retry-After` immediately when its local in-flight bound is saturated and releases capacity in a `finally` block after downstream completion or failure.

For a multi-instance Spring deployment, use the gateway or the application's existing distributed rate limiter for per-user quotas and keep the filter as a local in-flight backstop. The JVM executor itself currently uses a bounded host-execution worker pool (**64 workers with a finite 256-request queue**) and a bounded Apache connection pool. Those internal bounds prevent unbounded executor growth; they are deliberately not exposed as caller quotas because only the surrounding application knows who the caller is and which users should share limits.

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
