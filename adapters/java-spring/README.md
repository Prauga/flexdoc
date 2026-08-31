# FlexDoc Spring Boot Starter

Java/Spring adapter for the canonical FlexDoc browser renderer. The JAR packages the same version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` used by the Node integrations; it does not implement a Java-specific OpenAPI renderer.

Current source version: `0.1.0`. It targets renderer contract v1 / FlexDoc renderer 2.x.

> The artifact is prepared for Maven Central publication but should not be described as available from Central until the first release has actually been published and verified.

Planned coordinates:

```xml
<dependency>
  <groupId>com.prauga.flexdoc</groupId>
  <artifactId>flexdoc-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

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
```

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

A provider takes precedence over `spec-url`. `spec-location` creates the default provider only when explicitly configured.

The adapter intentionally owns only framework plumbing: obtaining the OpenAPI document, producing the small host page and serving packaged assets. OpenAPI rendering, Try It, code samples and schema behavior remain in the shared browser renderer.

## Building in this repository

Build the standalone renderer first, then package and verify the JAR:

```bash
npm run build:client
mvn -f adapters/java-spring/pom.xml verify
jar tf adapters/java-spring/target/flexdoc-spring-boot-starter-0.1.0.jar | grep META-INF/flexdoc
```

The release build attaches source and Javadoc JARs. CI should also verify that the resulting JAR contains both canonical renderer assets before publication.

For Central setup and the versioning model used by future language adapters, see [`docs/distribution.md`](../../docs/distribution.md).
