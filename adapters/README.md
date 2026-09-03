# FlexDoc language adapters

All language integrations are intentionally thin. They host a small HTML shell, expose the matching standalone renderer JS/CSS locally, and point that renderer at an OpenAPI URL. OpenAPI parsing, normalization, Try It, code samples, schema rendering, navigation, and theming remain in the canonical browser renderer.

Current adapters:

- C# / ASP.NET Core 8+ (`dotnet`)
- Java 17+ / Spring Boot 3 (`java-spring`)
- Go / `net/http` (`go`)
- Python 3.10+ / ASGI (`python`)
- Rust / Axum (`rust`)

The Go/Python/Rust adapters package committed renderer assets because those ecosystems publish source trees or source-derived artifacts. The ASP.NET Core and Spring Boot packages embed/copy the canonical renderer during package builds. In every case the source of truth is `packages/client/dist/standalone`; adapters do not introduce another renderer implementation.
