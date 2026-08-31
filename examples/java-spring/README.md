# Spring Boot + springdoc annotations

This example uses standard Swagger/OpenAPI annotations through `springdoc-openapi`, while FlexDoc serves the UI at `/docs` and consumes springdoc's generated `/v3/api-docs` document.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080/docs`.

The FlexDoc starter version is defined once as `<flexdoc.version>0.2.0</flexdoc.version>`; repository CI requires it to match the current Java adapter version.
