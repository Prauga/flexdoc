# FlexDoc architecture

FlexDoc has one product renderer and many integration adapters.

## Principle

Framework and language packages **must not implement OpenAPI rendering**. Their job is transport and integration only:

1. obtain an OpenAPI document (from the framework, a file, or a URL)
2. expose the FlexDoc host page
3. serve the version-matched FlexDoc renderer assets
4. optionally protect those routes using framework-native authentication/middleware

The browser renderer owns all OpenAPI/product behavior: navigation, schema presentation, search, code samples, request construction, Try It, theming, and future OpenAPI-version support.

## Host contract

Every adapter emits the same serializable inputs:

```ts
interface FlexDocHostContract {
  spec: OpenAPIDocument;
  options: FlexDocRendererOptions;
}
```

The current browser bootstrap exposes this contract as:

```js
window.FlexDocStandalone.mount(element, {
  spec,
  options,
});
```

The contract is intentionally JSON-compatible. A Go, Java, Rust, Python, .NET, or other adapter should not need a JavaScript/TypeScript implementation of FlexDoc internals; it only needs to serialize the OpenAPI document and options and serve the renderer artifacts.

## Package responsibilities

### `@prauga/flexdoc-client`

Canonical product implementation. It ships:

- React components for React consumers
- a self-contained standalone browser bundle for framework/language adapters
- renderer-side spec preparation that never mutates the caller's OpenAPI document

### `@prauga/flexdoc-backend`

Node/NestJS/Express adapter. It owns:

- route registration
- server-side loading of remote specs where appropriate
- documentation-route authentication
- serving version-matched renderer JS/CSS
- generation of the small host HTML document

It does **not** own schema rendering, endpoint rendering, code-sample generation, search, or other documentation UI logic.

## Multi-language distribution

Non-JavaScript adapters should package the exact renderer assets produced by a FlexDoc release. This can be done by publishing the standalone renderer as a versioned release artifact in addition to npm.

For example:

```text
FlexDoc release v2.1.0
├── flexdoc.standalone.js
├── flexdoc.standalone.css
├── npm packages
├── Go adapter
├── Java adapter
└── Python adapter
```

Adapters pin a renderer version and serve those files locally. This gives all languages identical rendering behavior without runtime CDN access.

## Rules for future features

A feature belongs in the renderer when it changes what documentation users see or do. Examples:

- OpenAPI 3.1 interpretation
- `$ref` handling for presentation
- schema composition
- code samples
- search
- Try It / request construction
- auth input for API calls
- deep links
- themes

A feature belongs in an adapter when it is framework/server specific. Examples:

- generating an OpenAPI document from NestJS decorators
- Express/Fastify route registration
- Spring Boot resource wiring
- middleware authentication
- loading a private spec from a server-only location

Following this boundary prevents FlexDoc from becoming N renderers that happen to share a name.
