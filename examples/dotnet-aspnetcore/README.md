# FlexDoc ASP.NET Core example

Minimal ASP.NET Core app using `Prauga.FlexDoc.AspNetCore` `0.2.0`.

```bash
dotnet run --project examples/dotnet-aspnetcore/Prauga.FlexDoc.AspNetCore.Example.csproj
```

Then open `/docs`. The example exposes its OpenAPI document at `/openapi.json` and demonstrates the zero-Swagger-dependency integration path: FlexDoc only needs an OpenAPI JSON URL.

During repository CI the example references the adapter project directly and the adapter embeds the canonical renderer built from `packages/client`.
