# Spring MVC disagreement loop

This example compares Spring's live `RequestMappingHandlerMapping` with a checked-in OpenAPI document (`flexdoc.spec-location=classpath:/openapi.json`). The two sources can disagree. FlexDoc does not fetch `/v3/api-docs` and does not read springdoc internals.

| Route | What FlexDoc records | Validation |
| --- | --- | --- |
| `GET /internal/health` | Runtime-only, listed in `flexdoc.acknowledged-undocumented` | Passes. The finding stays informational, and the route stays in the runtime record. |
| `POST /internal/reindex` | Runtime-only, not acknowledged | Fails. The finding names the method and path. |

Open **Runtime**, then `POST /internal/reindex`. The page shows that OpenAPI does not declare the operation beside the route Spring registered. **Open in API Client** sends that method and path.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080/docs`.

```bash
npx @prauga/flexdoc-cli validate http://localhost:8080/docs/__flexdoc/runtime
```

The command prints the acknowledged health route and exits 1 on `POST /internal/reindex`.

The starter pin in this example remains `<flexdoc.version>0.10.0</flexdoc.version>`, the published Java family release. That published starter reports the route snapshot and does not emit the validation object. CI installs the starter built from this repository before packaging the example, and that build does.
