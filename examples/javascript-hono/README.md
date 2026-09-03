# Hono + FlexDoc

This example uses Hono `4.13.x` with the framework-neutral `setupHonoFlexDoc` helper from `@prauga/flexdoc-backend` `2.2.0`. Hono remains an optional dependency.

The helper registers `/docs`, `/docs/`, and the two local renderer asset routes. It accepts either an inline `spec` or a browser-visible same-origin `specUrl`.
