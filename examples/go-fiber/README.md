# Fiber + FlexDoc

Fiber v3 can register standard `net/http` handlers directly, so FlexDoc does not need to pull Fiber into the core Go module. Register the existing `flexdoc.Handler(...)` on `/docs` and `/docs/*`. This example uses Fiber `v3.5.0` and FlexDoc Go adapter `v0.3.0`.
