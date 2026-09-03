# FlexDoc language adapters

All language integrations are intentionally thin. They host a small HTML shell, expose the matching standalone renderer JS/CSS locally, and point that renderer at an OpenAPI URL or document. OpenAPI parsing, normalization, Try It, code samples, schema rendering, navigation, and theming remain in the canonical browser renderer.

Current adapter families:

- C# / ASP.NET Core 8+ (`dotnet`)
- Java 17+ framework-neutral JVM host (`java-jvm`)
  - Jakarta REST / JAX-RS transport (`java-jaxrs`)
  - Spring Boot 3 transport (`java-spring`)
  - Quarkus, Micronaut, and Guice/Governator-style integration examples
- Go / `net/http` (`go`)
- Python 3.10+ / ASGI (`python`)
- Rust / Axum (`rust`)

The Java 0.4.x family deliberately puts renderer ownership in `flexdoc-jvm`. Spring Boot and Jakarta REST translate the neutral `FlexDocHttpResponse` into their framework response types; Micronaut and Guice-style applications can do the same without another FlexDoc package. Guice/Governator remain dependency-injection/lifecycle concerns rather than renderer boundaries.

The Go/Python/Rust adapters package committed renderer assets because those ecosystems publish source trees or source-derived artifacts. ASP.NET Core embeds the canonical assets during package build. The Java JVM host copies the canonical assets into `META-INF/flexdoc` during Maven packaging, and its framework transports depend on that host rather than packaging independent renderer copies. In every case the source of truth is `packages/client/dist/standalone`; adapters do not introduce another renderer implementation.
