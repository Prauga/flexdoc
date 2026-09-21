<div align="center">
  <a href="https://flexdoc.prauga.com">
    <img src="https://flexdoc.prauga.com/brand/flexdoc/favicon.svg" alt="FlexDoc logomark" width="88" height="88" />
  </a>
  <br /><br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://flexdoc.prauga.com/brand/flexdoc/wordmark-dark.svg" />
    <img src="https://flexdoc.prauga.com/brand/flexdoc/wordmark-light.svg" alt="FlexDoc" width="300" />
  </picture>

  <p><strong>Backend-native OpenAPI documentation, API exploration, and execution.</strong></p>
  <p>One canonical renderer. Thin native adapters. No FlexDoc control plane required.</p>

  <p>
    <a href="https://github.com/Prauga/flexdoc/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Prauga/flexdoc/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
    <a href="https://github.com/Prauga/flexdoc/actions/workflows/e2e.yml"><img alt="Browser E2E" src="https://github.com/Prauga/flexdoc/actions/workflows/e2e.yml/badge.svg?branch=main" /></a>
    <a href="https://github.com/Prauga/flexdoc/actions/workflows/host-impact.yml"><img alt="Host Impact" src="https://github.com/Prauga/flexdoc/actions/workflows/host-impact.yml/badge.svg?branch=main" /></a>
    <a href="https://github.com/Prauga/flexdoc/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Prauga/flexdoc" /></a>
    <a href="https://flexdoc.prauga.com"><img alt="Website" src="https://img.shields.io/badge/website-flexdoc.prauga.com-3461E1" /></a>
    <img alt="OpenAPI 3.x" src="https://img.shields.io/badge/OpenAPI-3.x-6BA539" />
    <img alt="Self-hosted" src="https://img.shields.io/badge/deployment-self--hosted-555" />
  </p>
</div>

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters so supported backends expose the same documentation, Try It, API Client, Runtime Intelligence, and backend-produced Contract Validation behavior where the host can genuinely observe it.

No FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## Published packages

<p align="center">
  <a href="https://www.npmjs.com/package/@prauga/flexdoc-client"><img alt="npm client" src="https://img.shields.io/npm/v/%40prauga%2Fflexdoc-client?label=npm%20client" /></a>
  <a href="https://www.npmjs.com/package/@prauga/flexdoc-backend"><img alt="npm backend" src="https://img.shields.io/npm/v/%40prauga%2Fflexdoc-backend?label=npm%20backend" /></a>
  <a href="https://www.npmjs.com/package/@prauga/flexdoc-cli"><img alt="npm CLI" src="https://img.shields.io/npm/v/%40prauga%2Fflexdoc-cli?label=npm%20CLI" /></a>
  <a href="https://www.npmjs.com/package/@prauga/flexdoc-core"><img alt="npm core" src="https://img.shields.io/npm/v/%40prauga%2Fflexdoc-core?label=npm%20core" /></a>
</p>
<p align="center">
  <a href="https://central.sonatype.com/artifact/com.prauga.flexdoc/flexdoc-jvm"><img alt="Maven Central" src="https://img.shields.io/maven-central/v/com.prauga.flexdoc/flexdoc-jvm?label=Maven%20Central" /></a>
  <a href="https://www.nuget.org/packages/Prauga.FlexDoc.AspNetCore"><img alt="NuGet" src="https://img.shields.io/nuget/v/Prauga.FlexDoc.AspNetCore?label=NuGet" /></a>
  <a href="https://pypi.org/project/prauga-flexdoc/"><img alt="PyPI" src="https://img.shields.io/pypi/v/prauga-flexdoc?label=PyPI" /></a>
  <a href="https://packagist.org/packages/prauga/flexdoc"><img alt="Packagist" src="https://img.shields.io/packagist/v/prauga/flexdoc?label=Packagist" /></a>
  <a href="https://rubygems.org/gems/prauga-flexdoc"><img alt="RubyGems" src="https://img.shields.io/gem/v/prauga-flexdoc?label=RubyGems" /></a>
  <a href="https://crates.io/crates/prauga-flexdoc-axum"><img alt="crates.io" src="https://img.shields.io/crates/v/prauga-flexdoc-axum?label=crates.io" /></a>
  <a href="https://hex.pm/packages/prauga_flexdoc"><img alt="Hex" src="https://img.shields.io/hexpm/v/prauga_flexdoc?label=Hex" /></a>
  <a href="https://pkg.go.dev/github.com/prauga/flexdoc/adapters/go"><img alt="Go Reference" src="https://pkg.go.dev/badge/github.com/prauga/flexdoc/adapters/go.svg" /></a>
</p>

## Backend coverage

- **JavaScript/TypeScript:** Express, Fastify, NestJS, Hono
- **C#/.NET:** ASP.NET Core
- **JVM:** Spring Boot, Jakarta/JAX-RS, Quarkus, Micronaut, Guice/Governator-style services, Kotlin Ktor
- **Python:** FastAPI/Starlette/ASGI, Flask/WSGI, Django
- **PHP:** generic PHP host, Laravel, Symfony
- **Ruby:** Rack, Rails
- **Go:** `net/http`, Gin, Chi, Echo v5, Fiber v3
- **Rust:** Axum, Actix Web
- **Elixir:** Plug, Phoenix

The backend-coverage program shipped in 2.3.0 and the coordinated 2.x line culminated in published **2.9.9**. Stable **3.0.0** added backend-native Runtime Intelligence, published **3.1.0** added operation-level Contract Validation on Node Express/Fastify/Hono/NestJS with matching renderer and CLI consumption, and **3.2.0** took the canonical API Client request/script/collection model into headless CLI/CI execution while reusing the existing advertised host-execution contract. **3.3.0** expands hardened native API-host execution across the supported backend ecosystems and makes an available API host the default transport for ordinary interactive API Client sends. See [`docs/releases/3.3.md`](./docs/releases/3.3.md) for the security and operational release notes.

## CLI

`@prauga/flexdoc-cli` is the first-class command-line surface for static docs, Contract Validation, and the 3.2 headless Runner:

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./public
npx @prauga/flexdoc-cli validate http://127.0.0.1:3000/docs/__flexdoc/runtime

# Headless Runner remains on the independently versioned CLI package.
node tools/flexdoc-cli/bin/flexdoc.js run ./pets.flexdoc.json --json
```

`validate` consumes the installed Node backend's structured 3.1 validation result rather than reimplementing contract comparison. It supports JSON output, custom headers, bearer/basic authentication for protected Runtime Intelligence endpoints, and opt-in stricter CI failure policies such as `--fail-on warning`. By default it exits `1` only when the backend reports `fail` (or the endpoint/payload cannot be consumed).

`run` consumes a versioned artifact exported from the canonical API Client workspace and delegates to the same collection/request executor and `flex.*` script/test runtime. Ordinary reusable/headless requests execute directly from Node unless host semantics are explicitly selected or required. See [`docs/headless-runner.md`](./docs/headless-runner.md) for the artifact, security, reporting, and cancellation contract.

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `3.3.1` |
| npm | `@prauga/flexdoc-backend` | `3.3.1` |
| npm | `@prauga/flexdoc-core` | `0.5.2` |
| npm | `@prauga/flexdoc-cli` | `0.7.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.6.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.9.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.9.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.9.0` |
| PyPI | `prauga-flexdoc` | `0.8.0` |
| Composer | `prauga/flexdoc` | `0.4.6` |
| RubyGems | `prauga-flexdoc` | `0.4.6` |
| crates.io | `prauga-flexdoc-host-execution` | `0.1.1` |
| crates.io | `prauga-flexdoc-axum` | `0.5.6` |
| crates.io | `prauga-flexdoc-actix` | `0.4.6` |
| Hex | `prauga_flexdoc` | `0.4.6` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.5.6` |

Ecosystem package versions are intentionally independent. FlexDoc 3.3.0 is the coordinated product/source release; native adapters retain their established ecosystem semver histories. Renderer contract v1 remains the cross-language compatibility boundary.

> The package table reflects the versions encoded by the current source commit. Release-preparation commits update these source versions only when the matching release is ready; source version numbers alone do not mean an artifact has been published.

## Architecture

```text
canonical browser renderer
  +-- Node backend -> Express / Fastify / NestJS / Hono
  +-- ASP.NET Core
  +-- JVM host -> Spring / Jakarta REST / Quarkus / Micronaut / Guice-Governator / Ktor
  +-- Python host -> ASGI / WSGI / FastAPI / Flask / Django
  +-- PHP host -> Laravel / Symfony
  +-- Ruby host -> Rack -> Rails
  +-- Go net/http -> Gin / Chi / Echo / Fiber v3
  +-- Rust -> Axum / Actix Web
  +-- Elixir Plug -> Phoenix
```

Adapters serve version-matched local renderer assets and do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

See [`examples/`](./examples/README.md), [`docs/host-execution.md`](./docs/host-execution.md), [`docs/releases/3.3.md`](./docs/releases/3.3.md), and [`docs/distribution.md`](./docs/distribution.md).

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).