# ASP.NET Core disagreement loop

This example compares the live `EndpointDataSource` with the same OpenAPI document the application serves at `/openapi.json`.

| Route | What FlexDoc records | Validation |
| --- | --- | --- |
| `GET /health` | Documented and registered | Matched. |
| `GET /internal/health` | Runtime-only, listed in `AcknowledgedUndocumented` | Passes. The finding stays informational, and the route stays in the runtime record. |
| `POST /internal/reindex` | Runtime-only, not acknowledged | Fails. The finding names the method and path. |

Open **Runtime**, then `POST /internal/reindex`. The page shows that OpenAPI does not declare the operation beside the route ASP.NET Core registered. **Open in API Client** sends that method and path.

```bash
dotnet run --project examples/dotnet-aspnetcore/Prauga.FlexDoc.AspNetCore.Example.csproj
```

Open `/docs`.

```bash
npx @prauga/flexdoc-cli validate http://localhost:5000/docs/__flexdoc/runtime
```

The command prints the acknowledged health route and exits 1 on `POST /internal/reindex`. The listen URL is the one `dotnet run` prints.

The example project references the adapter in this repository. The published NuGet package remains `Prauga.FlexDoc.AspNetCore` `0.7.0`, and that package reports the route snapshot without the validation object.
