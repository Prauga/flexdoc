# Spring Boot + springdoc + FlexDoc

This example uses standard Swagger/OpenAPI annotations through `springdoc-openapi`, while the FlexDoc Spring Boot starter serves the renderer at `/docs` and consumes springdoc's generated `/v3/api-docs` document. In 0.6.0 the Spring controller delegates all renderer hosting to the framework-neutral `flexdoc-jvm` host.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080/docs`.

The FlexDoc starter is pinned through `<flexdoc.version>0.6.0</flexdoc.version>`. CI installs the Java adapter family built from the same commit into the local Maven repository before building this example.
