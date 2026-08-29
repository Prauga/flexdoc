# FlexDoc Spring Boot Starter

Java/Spring adapter for the canonical FlexDoc browser renderer. The JAR packages the same version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` used by the Node integrations; it does not implement a Java-specific OpenAPI renderer.

## Configuration

```yaml
flexdoc:
  path: /docs
  spec-location: classpath:/openapi.json
  title: My API
  theme: dark
  try-it-enabled: true
```

With the starter on the classpath, `/docs` serves the FlexDoc host page and `/docs/__flexdoc/*` serves local renderer assets.

## Programmatic specs / springdoc

Instead of `spec-location`, provide a `FlexDocSpecProvider` bean. This keeps springdoc optional and allows the application to pass its generated OpenAPI model directly:

```java
@Bean
FlexDocSpecProvider flexDocSpecProvider(ObjectMapper mapper, OpenAPI openApi) {
  return () -> mapper.convertValue(openApi, Object.class);
}
```

The adapter intentionally owns only framework plumbing: obtaining the OpenAPI document, producing the small host page and serving packaged assets. OpenAPI rendering, Try It, code samples and schema behavior remain in the shared browser renderer.

## Building in this repository

Build the standalone renderer first, then package the JAR:

```bash
npm run build:client
mvn -f adapters/java-spring/pom.xml verify
```

CI verifies that the resulting JAR contains both renderer assets.
