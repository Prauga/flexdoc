# Laravel + FlexDoc

Install `prauga/flexdoc` `0.3.0` in a Laravel application. Package auto-discovery loads `FlexDocServiceProvider`, so the default configuration exposes FlexDoc at `/docs` and loads `/openapi.json`.

```bash
composer require prauga/flexdoc:0.3.0
```

Set `FLEXDOC_SPEC_URL` if your OpenAPI endpoint differs. The integration uses Laravel's router and response classes but delegates all renderer hosting to `FlexDocHost`.
