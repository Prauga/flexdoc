# Spring Boot + springdoc + FlexDoc

This example uses standard Swagger/OpenAPI annotations through `springdoc-openapi`, while the FlexDoc Spring Boot starter serves the renderer at `/docs` and consumes springdoc's generated `/v3/api-docs` document. The generated contract exercises the current Try It/API Client renderer while keeping the application code-first.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080/docs`.

The FlexDoc starter is pinned through `<flexdoc.version>0.3.0</flexdoc.version>`. During this release PR, CI installs the starter built from the same commit into the local Maven repository before building this example; after `0.3.0` is published, the POM works directly as written.
