# Prauga FlexDoc for PHP

`prauga/flexdoc` `0.1.0` provides a framework-neutral PHP 8.2+ host for the canonical FlexDoc renderer, plus thin Laravel and Symfony integrations. It is self-hosted and does not require a runtime CDN.

The canonical source remains in the FlexDoc monorepo. [`Prauga/flexdoc-php`](https://github.com/Prauga/flexdoc-php) is the Composer/Packagist distribution repository and is synchronized automatically from this package directory.

## Generic PHP

```php
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;

$host = new FlexDocHost(new FlexDocConfig(path: '/docs', specUrl: '/openapi.json', title: 'My API'));
```

`FlexDocConfig` also accepts `expand`, `tryItDefaultServer`, `tryItCredentials`, and `tryItApiClientPersistenceKey`; `expand` may be a preset string or section array, and the persistence key may be a string or `false`.

Map `responseForPath()` or the three explicit response methods through your HTTP framework.

## Laravel

Laravel package auto-discovery loads `FlexDocServiceProvider`, which binds `FlexDocHost` and registers the docs and renderer routes. Configure `flexdoc.path`, `flexdoc.spec_url`, `flexdoc.title`, `flexdoc.theme`, and `flexdoc.try_it_enabled` in the application config. The adapter also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; unset renderer settings are omitted. `FLEXDOC_TRY_IT=false` is parsed as a boolean and disables Try It. `LaravelFlexDoc::register($router, $host)` is also available for manual routing.

Laravel normalizes the request path used for route matching, so the single docs route serves both `/docs` and `/docs/`; the package integration tests dispatch both forms explicitly.

## Symfony

Register `FlexDocHost` as a service and inject it into `Prauga\FlexDoc\Symfony\FlexDocController`. Route `/docs`, `/docs/__flexdoc/renderer.js`, and `/docs/__flexdoc/renderer.css` to the controller's corresponding methods.

## Packaging

The package contains the version-matched `assets/flexdoc.standalone.{js,css}`. PHP CI byte-compares them with `packages/client/dist/standalone`.
