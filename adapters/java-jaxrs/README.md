# Prauga FlexDoc Jakarta REST adapter

`com.prauga.flexdoc:flexdoc-jaxrs` is a thin Jakarta REST/JAX-RS wrapper around `flexdoc-jvm`. Provide a `FlexDocHost` through CDI and register `FlexDocJaxRsResource`; the default resource serves `/docs`, its local renderer assets, and—when the host owns a native executor—the existing FlexDoc execute endpoint.

Renderer settings are configured on the shared JVM `FlexDocConfig`, including `expand(...)`/`expandSections(...)`, `tryItDefaultServer(...)`, `tryItCredentials(...)`, and `tryItApiClientPersistenceKey(...)`; JAX-RS does not maintain a second options model.

## Native API-host execution (3.3)

Create the shared JVM host with `tryItHostExecution(true)` and a real `FlexDocHostExecution` instance:

```java
FlexDocConfig config = FlexDocConfig.builder()
    .path("/docs")
    .specUrl("/openapi.json")
    .tryItHostExecution(true)
    .build();

FlexDocHost host = new FlexDocHost(
    config,
    null,
    new FlexDocHostExecution(List.of("https://api.example.internal")));
```

`FlexDocJaxRsResource` then exposes `POST /docs/__flexdoc/execute` and the renderer truthfully advertises `hostExecution.available: true`. The route consumes the same JSON or multipart envelope as the Node/Spring hosts and Runner. Multipart uses Jakarta REST 3.1's standard `List<EntityPart>` model, so the adapter does not depend on Jersey-, RESTEasy-, or Quarkus-specific multipart APIs.

The transport enforces the 32 MiB inbound envelope limit, requires `X-FlexDoc-Execute: 1`, emits no-store JSON responses, and delegates origin/redirect/metadata/header/auth/timeout/10 MiB response enforcement to the shared JVM executor. This slice intentionally advertises an empty host-only capability set; cookies, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.

The JVM executor performs DNS safety preflight but does not pin the validated address through Java 17 `HttpClient` connection establishment. Deployments with attacker-controlled DNS should enforce equivalent egress policy at the network layer as well.

## Custom paths

`FlexDocJaxRsResource` uses `@Path("/docs")` because Jakarta REST resource paths are annotation values and therefore compile-time constants. `FlexDocConfig.path()` cannot dynamically change that class-level route. For a custom path, subclass the resource (or create the same thin resource in your application) with a new `@Path` while keeping the injected `FlexDocHost` configured to the same path:

```java
@Path("/reference")
public final class ReferenceFlexDocResource extends FlexDocJaxRsResource {
  @Inject
  public ReferenceFlexDocResource(FlexDocHost host) {
    super(host);
  }
}
```

Configure that host with `FlexDocConfig.builder().path("/reference")...` so its generated renderer and execute URLs match the resource route. This path is suitable for Jakarta REST runtimes such as Quarkus/RESTEasy.
