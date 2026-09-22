<div align="center">
  <a href="https://flexdoc.prauga.com">
    <img src="https://flexdoc.prauga.com/brand/flexdoc/favicon.svg" alt="FlexDoc logomark" width="88" height="88" />
  </a>
  <br /><br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://flexdoc.prauga.com/brand/flexdoc/wordmark-dark.svg" />
    <img src="https://flexdoc.prauga.com/brand/flexdoc/wordmark-light.svg" alt="FlexDoc" width="300" />
  </picture>

  <p><strong>Your OpenAPI says one thing. Your backend may be running another.</strong></p>

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

FlexDoc runs inside your backend, compares the routes your framework actually registered with your OpenAPI contract, and tells you where they disagree. When it finds an undocumented runtime route, you can open it and reproduce it directly in the built-in API Client.

It also provides self-hosted API documentation, exploration, and execution. No FlexDoc account or control plane required.

Against the Express example, after its demo login:

```text
$ npx @prauga/flexdoc-cli validate \
    http://localhost:3000/docs/__flexdoc/runtime \
    --header 'Cookie: flexdoc-example-session=demo'

FlexDoc contract validation: FAIL
1 error, 0 warnings, 1 info · discovery complete

[INFO] runtime.operation-undocumented · GET /internal/health · acknowledged
Runtime implements GET /internal/health, but OpenAPI does not document that operation.

[ERROR] runtime.operation-undocumented · POST /internal/reindex
Runtime implements POST /internal/reindex, but OpenAPI does not document that operation.
```

```text
Open FlexDoc
    ↓
Runtime
    ↓
POST /internal/reindex
    ↓
Contract: OpenAPI does not declare this operation
Runtime: POST /internal/reindex is registered
    ↓
Open in API Client
```

**[Try the disagreement loop with Express](./examples/javascript-express).** That example is the evaluation path. `GET /internal/health` is runtime-only and acknowledged, so it does not fail validation. `POST /internal/reindex` is runtime-only and not acknowledged, so the check fails and the finding opens the route.

Once FlexDoc finds the disagreement, the same screen already has the documentation and API Client you need to investigate it. The package matrix and framework list below are the rest of the surface.

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

**3.5.0** is the current JavaScript release. On Node, a route the framework registered and OpenAPI does not document fails `flexdoc validate` when discovery is complete, and that finding opens in the API Client. See [`docs/releases/3.5.0.md`](./docs/releases/3.5.0.md). Earlier releases added Runtime Intelligence (**3.0.0**), Node contract validation (**3.1.0**), the headless Runner (**3.2.0**), and native API-host execution (**3.3.0**). [`CHANGELOG.md`](./CHANGELOG.md) records the published line.

## CLI

`@prauga/flexdoc-cli` is the first-class command-line surface for static docs, Contract Validation, and the 3.2 headless Runner:

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./public
npx @prauga/flexdoc-cli validate http://127.0.0.1:3000/docs/__flexdoc/runtime

# Headless Runner remains on the independently versioned CLI package.
node tools/flexdoc-cli/bin/flexdoc.js run ./pets.flexdoc.json --json
```

`validate` reads the Node backend's validation result. When discovery is complete, an undocumented runtime route is an error, the output names the method and path, and the command exits `1`. An acknowledged route stays in that output as info and does not fail the check. Partial discovery keeps an unacknowledged undocumented route a warning. The command also accepts JSON output, custom headers, and bearer or basic authentication for a protected runtime endpoint. `--fail-on warning` or `--fail-on info` makes the exit stricter.

`run` consumes a versioned artifact exported from the canonical API Client workspace and delegates to the same collection/request executor and `flex.*` script/test runtime. Ordinary reusable/headless requests execute directly from Node unless host semantics are explicitly selected or required. See [`docs/headless-runner.md`](./docs/headless-runner.md) for the artifact, security, reporting, and cancellation contract.

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `3.5.0` |
| npm | `@prauga/flexdoc-backend` | `3.5.0` |
| npm | `@prauga/flexdoc-core` | `0.5.2` |
| npm | `@prauga/flexdoc-cli` | `0.8.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.7.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.10.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.10.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.10.0` |
| PyPI | `prauga-flexdoc` | `0.9.0` |
| Composer | `prauga/flexdoc` | `0.5.0` |
| RubyGems | `prauga-flexdoc` | `0.5.0` |
| crates.io | `prauga-flexdoc-host-execution` | `0.2.0` |
| crates.io | `prauga-flexdoc-axum` | `0.6.0` |
| crates.io | `prauga-flexdoc-actix` | `0.5.0` |
| Hex | `prauga_flexdoc` | `0.5.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.6.0` |

Ecosystem package versions are intentionally independent. Client, backend, and CLI **3.5.0** / **0.8.0** publish the Node disagreement loop. Native adapters keep their own version lines. Renderer contract v1 remains the cross-language compatibility boundary.

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

## Community

FlexDoc follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Bug reports and feature requests use the issue forms. Report security vulnerabilities through a [private advisory](https://github.com/Prauga/flexdoc/security/advisories/new), not a public issue.

## License

FlexDoc is licensed under **Apache-2.0**. See [LICENSE](./LICENSE).

The renderer, API Client, headless runner, CLI and every framework adapter are permissively licensed and stay that way — you can embed them in a proprietary application without obligation. Any future hosted or fleet control-plane product is separate code and will carry its own license; nothing in this repository depends on it.