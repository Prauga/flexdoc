# Prauga FlexDoc for PHP

`prauga/flexdoc` `0.4.4` provides a framework-neutral PHP 8.2+ host for the canonical FlexDoc renderer, plus thin Laravel and Symfony integrations. It is self-hosted and does not require a runtime CDN.

The canonical source remains in the FlexDoc monorepo. [`Prauga/flexdoc-php`](https://github.com/Prauga/flexdoc-php) is the Composer/Packagist distribution repository and is synchronized automatically from this package directory.

## Generic PHP

```php
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;

$host = new FlexDocHost(new FlexDocConfig(path: '/docs', specUrl: '/openapi.json', title: 'My API'));
```

`FlexDocConfig` also accepts `expand`, `tryItDefaultServer`, `tryItCredentials`, and `tryItApiClientPersistenceKey`; `expand` may be a preset string or section array, and the persistence key may be a string or `false`.

Map `responseForPath()` or the explicit response methods through your HTTP framework.

## Native API-host execution (3.3)

PHP can execute Try It requests from the API host without adding cURL or a third-party HTTP client. HTTPS execution requires PHP's OpenSSL extension, which is declared as a Composer platform requirement. Create a native executor with an explicit exact-origin allowlist and attach it to the renderer configuration:

```php
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\HostExecution;

$executor = new HostExecution([
    'https://api.example.internal',
]);

$host = new FlexDocHost(new FlexDocConfig(
    path: '/docs',
    specUrl: '/openapi.json',
    tryItHostExecution: true,
    hostExecution: $executor,
));
```

When both `tryItHostExecution: true` and a real `HostExecution` are present, FlexDoc truthfully advertises `hostExecution.available: true` and the host owns `POST /docs/__flexdoc/execute`. Enabling the flag without an executor keeps `available: false`, and the execute path remains unregistered (`404`). The allowlist is server-only configuration and is never serialized into the docs HTML.

The PHP executor consumes the same canonical JSON or multipart envelope used by the other native hosts and FlexDoc Runner. It requires `X-FlexDoc-Execute: 1`, accepts only explicitly allowlisted HTTP(S) origins, strips unsafe transport headers, rejects cross-origin redirects, bounds incoming envelopes to 32 MiB and target response bodies to 10 MiB, bounds response header parsing, and applies a full-request deadline. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported as canonical request-draft features.

This first PHP slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively. The 3.3 client host-routing change is responsible for sending ordinary Try It requests through an available native executor; capability entries remain reserved for additional host-only features.

The transport uses PHP's standard socket/TLS runtime rather than requiring `ext-curl`. Hostnames are resolved and validated first, then the connection is opened directly to one of the validated addresses while retaining the original hostname for the HTTP `Host` header and TLS SNI/certificate verification. Link-local/cloud-metadata destinations, including IPv4-mapped IPv6 forms, are rejected before connection. System HTTP proxy variables are not consulted by this socket transport.

The execute endpoint is a server-side network capability. Protect the docs subtree and `__flexdoc/execute` with the same application authentication/authorization policy you expect for the API documentation. `X-FlexDoc-Execute: 1` is a protocol marker and cross-site friction, not a replacement for application authorization.

For framework-neutral integrations, route `responseForRequest()` so POST requests to the execute path can pass request headers/body and, for multipart requests, the parsed `descriptor` and uploaded `formData[n]` files.

## Laravel

Laravel package auto-discovery loads `FlexDocServiceProvider`, which binds `FlexDocHost` and registers the docs and renderer routes. Configure `flexdoc.path`, `flexdoc.spec_url`, `flexdoc.title`, `flexdoc.theme`, and `flexdoc.try_it_enabled` in the application config. The adapter also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; unset renderer settings are omitted. `FLEXDOC_TRY_IT=false` is parsed as a boolean and disables Try It. `LaravelFlexDoc::register($router, $host)` is also available for manual routing.

For native host execution, enable `try_it_host_execution` and provide `host_execution_allowed_origins` as an array or comma-separated string. The packaged config exposes `FLEXDOC_HOST_EXECUTION` and `FLEXDOC_HOST_EXECUTION_ALLOWED_ORIGINS`. Laravel registers the POST execute route only when a real executor can be created from a non-empty allowlist.

Protect the whole FlexDoc route set with Laravel middleware. With auto-discovery, set `flexdoc.middleware` to an array such as `['auth']`, or set a comma-separated environment value such as:

```dotenv
FLEXDOC_MIDDLEWARE=auth,verified
```

For manual registration, pass the middleware directly:

```php
LaravelFlexDoc::register($router, $host, ['auth', 'verified']);
```

The configured middleware is attached to the docs page, renderer assets, and execute POST together. If your selected middleware stack includes Laravel's CSRF verifier, configure the application so `POST /docs/__flexdoc/execute` is exempted or use an API-style authentication middleware for this route; the browser execute protocol sends `X-FlexDoc-Execute: 1`, not a Laravel CSRF token. Do not expose the execute route without application authorization merely because the destination origin is allowlisted.

Laravel normalizes the request path used for route matching, so the single docs route serves both `/docs` and `/docs/`; the package integration tests dispatch both forms explicitly.

## Symfony

Register `FlexDocHost` as a service and inject it into `Prauga\FlexDoc\Symfony\FlexDocController`. Route `/docs`, `/docs/__flexdoc/renderer.js`, and `/docs/__flexdoc/renderer.css` to the controller's corresponding methods. When native execution is enabled on the injected host, route `POST /docs/__flexdoc/execute` to `FlexDocController::execute`. Apply your Symfony firewall/access-control policy to the docs and execute paths; the controller deliberately does not invent a second authentication model.

## Packaging

The package contains the version-matched `assets/flexdoc.standalone.{js,css}`. PHP CI byte-compares them with `packages/client/dist/standalone`.
