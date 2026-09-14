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

### Resource limits

The shared pinned Apache client is intentionally bounded:

- at most **64** concurrent FlexDoc transport workers;
- at most **256** additional queued executions before overload is rejected;
- the Apache connection manager is capped at **256 total** and **256 per route** connections;
- pooled connections have a **30 second** time-to-live and are revalidated after **2 seconds** of inactivity;
- connection acquisition, connect/socket work and the overall executor future remain covered by the canonical request deadline;
- changed DNS pin sets use a different HttpClient user token, so a socket created for an earlier validated address set cannot be reused after rebinding.

The finite worker/queue boundary is a safety ceiling, not an application rate limit. Production deployments should still apply per-user/session or gateway rate limits and concurrency controls to the execute HTTP route.

For Guice or Governator-style applications, bind a configured `FlexDocHost` as a singleton and have the application's existing HTTP layer translate `FlexDocHttpResponse` into its native response type. Governator is built around Guice lifecycle/DI, so no renderer-specific Governator integration is required. If that HTTP layer exposes native execution, protect it with the same application security policy as the docs route rather than treating the FlexDoc marker as authorization.
