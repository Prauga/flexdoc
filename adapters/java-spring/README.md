# Prauga FlexDoc Spring Boot Starter

Spring Boot transport for the canonical FlexDoc browser renderer. Starting with the Java `0.4.x` family, the starter delegates renderer hosting to the framework-neutral `com.prauga.flexdoc:flexdoc-jvm` package rather than maintaining a Spring-specific HTML/asset implementation.

Current source version: `0.9.0`. It targets Java 17+, Spring Boot 3, renderer contract v1, and the FlexDoc renderer 3.x line.

Coordinates:

```xml
<dependency>
  <groupId>com.prauga.flexdoc</groupId>
  <artifactId>flexdoc-spring-boot-starter</artifactId>
  <version>0.9.0</version>
</dependency>
```

The Java package namespace is `com.prauga.flexdoc.spring`. The starter depends on `com.prauga.flexdoc:flexdoc-jvm:0.9.0`, whose JAR owns the version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` assets.

## Spring Boot + springdoc

If your application already exposes the standard springdoc endpoint at `/v3/api-docs`, the default configuration is enough. Adding the starter exposes FlexDoc at `/docs`; the browser loads `/v3/api-docs` from the same origin and the shared renderer handles references, Try It, schemas and code examples.

Optional configuration:

```yaml
flexdoc:
  path: /docs
  spec-url: /v3/api-docs
  title: My API
  theme: dark
  try-it-enabled: true
  expand: documentation
  # expand-sections: [parameters, tryIt] # list wins over expand when both are set
  try-it-default-server: https://api.example.com
  try-it-credentials: include
  try-it-api-client-persistence-key: my-api-workspace # use false to disable persistence
```

The four renderer settings (`expand`, Try It default server/credentials, and API Client persistence key) are omitted when unset, preserving the renderer's compact/default behavior.

The renderer assets are served locally at `/docs/__flexdoc/*`, so the integration has no runtime CDN dependency.

## Native host execution (3.3 source)

Spring implements FlexDoc's existing API-host execution envelope through the shared JVM host. It is opt-in and requires an explicit exact-origin allowlist plus an acknowledgement that the application has already protected the docs/execute surface:

```yaml
flexdoc:
  try-it-host-execution: true
  host-execution-protected: true
  try-it-host-execution-allowed-origins:
    - https://api.example.com
    - https://staging-api.example.com
```

Set `host-execution-protected: true` only after Spring Security, an application filter, or an upstream gateway actually requires the intended authentication/authorization for `/docs` and `/docs/**`. The property is an assertion, not a security mechanism: it does not install authentication, authorization, or CSRF protection. If Spring would attach a real native executor while this acknowledgement is false or omitted, `FlexDocHost` construction fails closed. Merely advertising the host-execution protocol without a real executor can still represent `hostExecution.available: false` without the acknowledgement.

When enabled and protected, the docs page advertises `hostExecution.available: true` and Spring registers `POST <docsPath>/__flexdoc/execute`. The route requires `X-FlexDoc-Execute: 1`, strips unsafe browser/request headers, accepts only HTTP(S), rejects cross-origin redirects, revalidates each target against the exact-origin allowlist, rejects literal/link-local/cloud-metadata targets and dangerous DNS resolutions, clamps execution timeouts, limits incoming execute envelopes to 32 MiB, and streams responses through a 10 MiB bound.

The Spring transport consumes the same canonical execute protocol as Node and the 3.2 Runner: JSON descriptors, Base64 binary bodies, and multipart requests containing the `descriptor` plus indexed `formData[n]` browser file parts. Multipart files are reassembled into the canonical request draft and the JVM executor generates the outbound multipart body and boundary.

This first native slice intentionally advertises an empty host-only capability list. It supports ordinary canonical HTTP execution, including query/header/body modes plus None, Basic, Bearer, OAuth 2.0 access-token, and header/query API-key authentication. Cookie jars, client certificates, Digest, Hawk, NTLM, OAuth 1.0, and AWS Sig V4 remain unavailable and are rejected rather than advertised. JAX-RS uses the same shared JVM executor with its own execute binding; Java transports without a native execute binding continue to advertise `available: false`.

The shared JVM executor resolves and validates the target for each request or redirect, then uses its Apache HttpClient transport to connect through the validated address set while preserving the original hostname for HTTP authority and TLS verification. Link-local/cloud-metadata destinations are rejected before connection, and system proxy routing is not used for host execution.

Application middleware still protects the docs subtree and therefore the execute route. The exact-origin list is an execution boundary, not an authentication mechanism, and `X-FlexDoc-Execute: 1` is a protocol marker rather than a CSRF defense. `host-execution-protected` simply makes that application-owned responsibility explicit at startup.

### Spring Security / CSRF

If Spring Security CSRF protection is enabled, the browser-owned execute POST must either participate in the application's CSRF-token mechanism or be narrowly excluded from CSRF checks. Do not disable CSRF globally just to enable FlexDoc. A typical application-owned configuration can ignore only the execute endpoint while keeping authentication/authorization on the docs shell and subtree:

```java
@Bean
SecurityFilterChain security(HttpSecurity http) throws Exception {
  http
      .authorizeHttpRequests(auth -> auth
          .requestMatchers("/docs", "/docs/**").authenticated()
          .anyRequest().permitAll())
      .csrf(csrf -> csrf
          .ignoringRequestMatchers("/docs/__flexdoc/execute"));
  return http.build();
}
```

Adapt the path when `flexdoc.path` is customized. Configure this authentication/authorization boundary before setting `host-execution-protected: true`. The execute route still requires the FlexDoc marker and exact-origin policy, but those controls do not replace application authentication or CSRF policy.

### Admission control

When native host execution is enabled, the starter now auto-registers `FlexDocHostExecutionAdmissionFilter` only for `<docsPath>/__flexdoc/execute`. The registration is intentionally late in the servlet filter chain so Spring Security and ordinary application authentication/CSRF filters run first; the FlexDoc execute controller remains downstream of admission control.

Defaults are 16 concurrent execute requests per process with `Retry-After: 1`. Override them when the application needs a lower process-local ceiling:

```yaml
flexdoc:
  try-it-host-execution: true
  host-execution-protected: true
  host-execution-max-in-flight: 16
  host-execution-retry-after-seconds: 1
```

When saturated, the filter rejects immediately with HTTP `429 Too Many Requests`, the configured `Retry-After`, `Cache-Control: no-store`, and does not enter the execute controller. Capacity is always released after downstream completion or failure. The URL pattern follows normalized `flexdoc.path` automatically, so custom docs paths do not require a separate filter bean.

The filter is not authentication, CSRF protection, or a caller quota. Multi-replica deployments should still use the application's authenticated gateway/distributed limiter for per-user or per-session rate limits. The shared JVM executor separately has fixed last-resort safety ceilings of 64 transport workers and 256 queued executions; keep the earlier HTTP admission bound materially below those internal limits. See [`../java-jvm`](../java-jvm/README.md#resource-limits-and-production-tuning) and [`docs/host-execution-operations.md`](../../docs/host-execution-operations.md).

### Multipart limits

Spring's multipart parser runs before `FlexDocHostExecutionController`, so framework-level multipart limits can reject a request before FlexDoc's own 32 MiB envelope bound executes. When browser file execution is required, configure Spring's multipart ceilings to admit the FlexDoc maximum (or a deliberately smaller application limit):

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 32MB
      max-request-size: 32MB
```

Keeping smaller application limits is valid; it simply means those limits become the effective ceiling. Do not configure Spring above what the surrounding reverse proxy, ingress, or application is prepared to accept.

## Classpath or programmatic specs

To embed a checked-in specification instead of using a URL:

```yaml
flexdoc:
  spec-location: classpath:/openapi.json
```

Or provide a `FlexDocSpecProvider` bean for a generated OpenAPI model:

```java
@Bean
FlexDocSpecProvider flexDocSpecProvider(ObjectMapper mapper, OpenAPI openApi) {
  return () -> mapper.convertValue(openApi, Object.class);
}
```

A provider takes precedence over `spec-url`. `spec-location` creates the default provider only when explicitly configured. The Spring auto-configuration serializes that provider into the neutral `FlexDocHost`; the MVC controller only converts `FlexDocHttpResponse` into a `ResponseEntity`.

## Runtime Intelligence

Spring MVC can opt into FlexDoc 3.0 Runtime Intelligence using the live `RequestMappingHandlerMapping` registry:

```yaml
flexdoc:
  path: /docs
  spec-url: /v3/api-docs
  runtime-intelligence: true
```

Runtime Intelligence also requires a `FlexDocSpecProvider` so FlexDoc compares the live request-mapping registry with the exact application-generated OpenAPI document rather than fetching `spec-url` back through HTTP or coupling itself to springdoc internals. Existing `spec-location` configuration already creates such a provider; for springdoc or another code-first producer, supply a programmatic provider bean.

When enabled, `GET /docs/__flexdoc/runtime` returns a `Cache-Control: no-store` snapshot containing Spring/Java runtime metadata, the request-derived server origin, live routes, implemented-but-undocumented routes, documented-but-not-observed routes, and discovery completeness. Spring route constraints such as `{id:\d+}` and capture-all parameters are normalized to OpenAPI `{id}` form. Methodless or wildcard mappings that cannot be represented as one OpenAPI operation make discovery partial instead of being expanded speculatively. The configured OpenAPI route and the FlexDoc docs subtree are excluded.

Runtime discovery can reveal intentionally undocumented endpoints. The Spring adapter relies on Spring Security/application middleware or upstream access control rather than a FlexDoc-native docs-auth option, so protect the docs subtree before enabling Runtime Intelligence on non-private documentation.

## Building in this repository

Build the standalone renderer first, then build the coordinated Java family:

```bash
npm run build:client
mvn -f adapters/java/pom.xml verify
```

The renderer assets should be present in the neutral JVM artifact, not duplicated in the Spring starter:

```bash
jar tf adapters/java-jvm/target/flexdoc-jvm-0.9.0.jar | grep META-INF/flexdoc
```

The Java release build attaches source and Javadoc JARs for `flexdoc-jvm`, `flexdoc-jaxrs`, and `flexdoc-spring-boot-starter`. CI byte-compares the renderer in `flexdoc-jvm` with the canonical browser build and regression-builds the Spring example.

See [`../java-jvm`](../java-jvm/README.md), [`../java-jaxrs`](../java-jaxrs/README.md), and [`docs/distribution.md`](../../docs/distribution.md) for the wider Java family.