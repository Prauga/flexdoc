# Spring Boot + FlexDoc 3.3 Runtime Intelligence

This Spring MVC example keeps the standard `springdoc-openapi` code-first annotations, but the FlexDoc Runtime Intelligence comparison deliberately uses an exact checked-in OpenAPI document through `flexdoc.spec-location=classpath:/openapi.json`.

That separation is intentional: FlexDoc can inspect the live `RequestMappingHandlerMapping` registry without coupling the adapter to springdoc internals or making a server-side HTTP request back to `/v3/api-docs`. The checked-in document creates the `FlexDocSpecProvider` required by Runtime Intelligence.

The contract documents the normal pet/upload operations. `GET /internal/health` exists only in the running Spring application, so the **Runtime** panel reports a real implemented-but-undocumented route. The same `/docs` surface also exposes the canonical renderer/API Client workflows.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080/docs`.

The starter is pinned through `<flexdoc.version>0.10.0</flexdoc.version>`, the Java family release published for FlexDoc 3.3. CI installs the Java adapter family built from the same commit before building this example.
