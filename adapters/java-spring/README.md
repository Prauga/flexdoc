# Prauga FlexDoc Spring Boot Starter

Spring Boot transport for the canonical FlexDoc browser renderer. Starting with the Java `0.4.x` family, the starter delegates renderer hosting to the framework-neutral `com.prauga.flexdoc:flexdoc-jvm` package rather than maintaining a Spring-specific HTML/asset implementation.

Current source version: `0.6.0`. It targets Java 17+, Spring Boot 3, renderer contract v1, and the FlexDoc renderer 2.x line.

Coordinates:

```xml
<dependency>
  <groupId>com.prauga.flexdoc</groupId>
  <artifactId>flexdoc-spring-boot-starter</artifactId>
  <version>0.6.0</version>
</dependency>
```

The Java package namespace is `com.prauga.flexdoc.spring`. The starter depends on `com.prauga.flexdoc:flexdoc-jvm:0.6.0`, whose JAR owns the version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` assets.

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

## Building in this repository

Build the standalone renderer first, then build the coordinated Java family:

```bash
npm run build:client
mvn -f adapters/java/pom.xml verify
```

The renderer assets should be present in the neutral JVM artifact, not duplicated in the Spring starter:

```bash
jar tf adapters/java-jvm/target/flexdoc-jvm-0.6.0.jar | grep META-INF/flexdoc
```

The Java release build attaches source and Javadoc JARs for `flexdoc-jvm`, `flexdoc-jaxrs`, and `flexdoc-spring-boot-starter`. CI byte-compares the renderer in `flexdoc-jvm` with the canonical browser build and regression-builds the Spring example.

See [`../java-jvm`](../java-jvm/README.md), [`../java-jaxrs`](../java-jaxrs/README.md), and [`docs/distribution.md`](../../docs/distribution.md) for the wider Java family.
