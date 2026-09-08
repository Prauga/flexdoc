# FlexDoc ASP.NET Core 3.0 example

Minimal ASP.NET Core application using `Prauga.FlexDoc.AspNetCore` `0.5.1` and the FlexDoc 3.0 Runtime Intelligence surface.

```bash
dotnet run --project examples/dotnet-aspnetcore/Prauga.FlexDoc.AspNetCore.Example.csproj
```

Open `/docs`. The application exposes its exact OpenAPI document at `/openapi.json` and passes that same server-side document to `RuntimeOpenApiDocument`, allowing FlexDoc to compare the live `EndpointDataSource` with the documented operations without depending on Swashbuckle or NSwag.

`GET /health` is documented, while `POST /internal` is deliberately runtime-only. Open the **Runtime** panel to see the drift detected from the running ASP.NET Core router. The browser-facing renderer is the same canonical 3.0 surface used by every adapter, including Try It/API Client handoff, persisted preferences and response inspection.

During repository CI the example references the adapter project directly and the adapter embeds the canonical renderer built from `packages/client`. The NuGet version remains `0.5.0` until the coordinated 3.0 release versioning pass.
