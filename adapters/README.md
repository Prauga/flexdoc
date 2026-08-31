# FlexDoc language adapters

All language integrations are intentionally thin. They host a small HTML shell, expose the matching standalone renderer JS/CSS locally, and point that renderer at an OpenAPI URL. OpenAPI parsing, normalization, Try It, code samples, schema rendering, navigation, and theming remain in the canonical browser renderer.

Current adapters:

- Java 17+ / Spring Boot 3 (`java-spring`)
- Go / `net/http` (`go`)
- Python 3.10+ / ASGI (`python`)
- Rust / Axum (`rust`)

The Go/Python/Rust adapters accept a local renderer asset directory/filesystem. Use the version-matched files produced by `packages/client/dist/standalone`; release packaging can copy these exact assets without introducing another renderer implementation.
