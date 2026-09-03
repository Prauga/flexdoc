# Framework adapters

FlexDoc integrations are intentionally thin. Every framework serves the same standalone browser renderer and passes it an OpenAPI document plus renderer options. FlexDoc does **not** invent a competing annotation system: use the ecosystem's established OpenAPI annotations, decorators, schemas, types, or macros and feed the generated OpenAPI 3.x document into FlexDoc.

## JavaScript / TypeScript

### Express + swagger-jsdoc

Generate OpenAPI from JSDoc comments with `swagger-jsdoc`, then pass the resulting object directly:

```ts
import swaggerJsdoc from 'swagger-jsdoc';
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';

const spec = swaggerJsdoc({
  definition: { openapi: '3.1.0', info: { title: 'Orders API', version: '1.0.0' } },
  apis: ['./src/routes/**/*.ts'],
});

setupExpressFlexDoc(app, '/docs', { spec });
```

### Fastify + @fastify/swagger

Register `@fastify/swagger`, describe routes with Fastify schemas, then let FlexDoc consume the generated document in memory:

```ts
import swagger from '@fastify/swagger';
import { setupFastifySwaggerFlexDoc } from '@prauga/flexdoc-backend';

await fastify.register(swagger, { openapi: { info: { title: 'Orders API', version: '1.0.0' } } });

fastify.get('/orders/:id', {
  schema: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    response: { 200: { type: 'object', properties: { id: { type: 'string' } } },
  },
}, handler);

setupFastifySwaggerFlexDoc(fastify, '/docs');
```

`setupFastifyFlexDoc` remains available for an explicit `spec` or `specUrl`.

### NestJS + @nestjs/swagger

Nest decorators remain the source of truth:

```ts
@ApiOperation({ summary: 'Get an order' })
@ApiResponse({ status: 200, type: OrderDto })
@Get(':id')
getOrder(@Param('id') id: string) { /* ... */ }
```

Then:

```ts
const config = new DocumentBuilder().setTitle('Orders API').setVersion('1.0').addBearerAuth().build();
setupNestFlexDoc(app, '/docs', config);
```

## Java / JVM

Java `0.4.x` uses `com.prauga.flexdoc:flexdoc-jvm` as the framework-neutral host. `FlexDocHost` owns HTML bootstrapping, cache policy, renderer fingerprinting, and the packaged canonical JS/CSS. Framework code only translates `FlexDocHttpResponse` into its native HTTP response.

```java
FlexDocHost host = new FlexDocHost(
    FlexDocConfig.builder()
        .path("/docs")
        .specUrl("/openapi.json")
        .title("Orders API")
        .build());
```

### Spring Boot + springdoc

Use standard Swagger/OpenAPI annotations such as `@Operation`, `@Parameter`, `@ApiResponse`, and `@Schema`. Springdoc generates `/v3/api-docs`; the FlexDoc starter uses that endpoint by default.

```java
@Operation(summary = "Get an order")
@ApiResponse(responseCode = "200", description = "Order found")
@GetMapping("/orders/{id}")
Order getOrder(@Parameter(description = "Order ID") @PathVariable String id) { /* ... */ }
```

The Spring Boot starter depends on `flexdoc-jvm`; its MVC controller no longer maintains separate renderer-hosting logic.

### Jakarta REST / JAX-RS + Quarkus

`com.prauga.flexdoc:flexdoc-jaxrs` converts the neutral host response into a Jakarta REST `Response`. A CDI application provides the host and can expose the stock resource at `/docs` or delegate to it from an application resource.

```java
@Produces
@Singleton
FlexDocHost flexDocHost() {
  return new FlexDocHost(FlexDocConfig.builder()
      .specUrl("/openapi.json")
      .title("Orders API")
      .build());
}
```

The repository's Quarkus example boots a real Quarkus REST test runtime and verifies the documentation page plus both local renderer assets.

### Micronaut

Micronaut does not need another FlexDoc artifact. Bind `FlexDocHost` as a singleton/factory bean and map three controller routes to `documentation()`, `rendererJavaScript()`, and `rendererCss()`. This keeps Micronaut-specific code limited to HTTP response translation.

### Guice / Governator-style applications

Bind a configured `FlexDocHost` in the Guice object graph and expose it through whatever HTTP stack the service already uses. The repository example uses the JDK HTTP server to prove the host has no Spring/Jakarta dependency.

Governator is built around Guice lifecycle and dependency injection rather than defining a FlexDoc-specific HTTP boundary. A Governator service can therefore bind the same `FlexDocHost` singleton and translate its neutral response through the service's existing HTTP framework; no renderer fork or Governator-specific package is required.

No FlexDoc-specific Java annotations are required in any of these paths.

## Python / FastAPI

FastAPI already generates OpenAPI from route decorators, type hints, Pydantic models, security dependencies, and response metadata. The helper mounts FlexDoc against FastAPI's generated `openapi_url`:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from prauga_flexdoc import setup_fastapi_flexdoc

app = FastAPI(docs_url=None, redoc_url=None)

class Order(BaseModel):
    id: str

@app.get('/orders/{order_id}', response_model=Order, summary='Get an order')
async def get_order(order_id: str): ...

setup_fastapi_flexdoc(app, '/docs')
```

The generic `FlexDocASGI` integration remains available for Starlette, Django ASGI, Quart, and other ASGI hosts.

## Go / Huma and other generators

The Go adapter can consume a generated OpenAPI value directly:

```go
spec := api.OpenAPI() // e.g. Huma's generated OpenAPI document

docs, err := flexdoc.HandlerFromOpenAPI(flexdoc.Config{
    Path: "/docs",
    Title: "Orders API",
    TryItEnabled: true,
}, spec)
if err != nil { log.Fatal(err) }

http.Handle("/docs/", docs)
```

This works with any JSON-serializable OpenAPI 3.x value. FlexDoc intentionally does not define Go-specific comment annotations or struct tags; use the generator native to your framework. `swaggo/swag` currently emits Swagger 2.0, which is not accepted by FlexDoc's OpenAPI 3.x parser.

## Rust / Axum + utoipa

Use `utoipa` / `utoipa-axum` macros and derives, then pass the generated `OpenApi` value directly:

```rust
#[derive(utoipa::ToSchema)]
struct Order { id: String }

#[utoipa::path(get, path = "/orders/{id}", responses((status = 200, body = Order)))]
async fn get_order() {}

#[derive(utoipa::OpenApi)]
#[openapi(paths(get_order), components(schemas(Order)))]
struct ApiDoc;

let docs = prauga_flexdoc_axum::router_with_openapi(
    prauga_flexdoc_axum::Config::default(),
    &ApiDoc::openapi(),
)?;
```

## Adapter contract

An adapter is responsible for only four things:

1. obtain or generate the OpenAPI document;
2. render the small FlexDoc host HTML with safely serialized JSON;
3. serve the version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` assets locally;
4. optionally implement framework-native documentation-route access control and server-side spec loading.

OpenAPI normalization, request construction, Try It, API Client request semantics, code generation, schemas, search, navigation, theming and responsive UI belong to the canonical browser renderer/client engine and must not be reimplemented by adapters.
