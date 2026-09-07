# Performance and production readiness

FlexDoc 2.9.9 established the production-readiness baseline before 3.0 Runtime Intelligence. The 3.0 UI/Product Completion Gate keeps the same operator question measurable as the renderer grows: **what does installing FlexDoc cost the service that hosts it?**

## What we measure

The repository owns a repeatable Node baseline through `npm run benchmark:performance` and the `Performance Baseline` GitHub Actions workflow.

The baseline records:

- canonical standalone JavaScript and CSS raw, gzip, and Brotli sizes;
- OpenAPI host-page serialization for approximately 100 KiB, 1 MiB, 5 MiB, and 10 MiB specifications, including p50/p95/p99;
- first render cost versus warm cached-page lookup cost and 100-request cold-cache coalescing;
- clean Node process startup versus FlexDoc backend import/setup time and RSS;
- generated host-page size and benchmark-process memory snapshot;
- the exact Node/platform metadata used for the run.

Workflow results are uploaded as `performance-results.json`. The workflow also publishes `flexdoc-standalone-renderer`, containing the exact standalone JS/CSS produced by that measured build, so renderer parity and release validation can use one byte-identical canonical artifact.

Wall-clock measurements remain evidence rather than hard CI budgets because shared runners are noisy. Deterministic bundle sizes are stable enough to gate, so CI enforces explicit raw/gzip/Brotli ceilings through `npm run check:performance-budgets -- performance-results.json`.

## Regression budgets

The original 2.9.9 baseline used a 540 / 160 / 135 KiB JavaScript ceiling before the 3.0 renderer gained the full API Client completion surface, CodeMirror editing, command/navigation UX, and Runtime Intelligence UI. The 3.0 gate therefore establishes a new measured ceiling instead of silently exempting the larger product.

The September 7, 2026 3.0 gate run measured the standalone renderer at 815.9 KiB raw / 249.8 KiB gzip / 211.1 KiB Brotli for JavaScript and 41.1 / 8.2 / 7.0 KiB for CSS. The enforced budgets retain only narrow headroom above those values:

| Asset | Raw budget | Gzip budget | Brotli budget | 3.0 measured baseline |
| --- | ---: | ---: | ---: | ---: |
| standalone JavaScript | 840 KiB | 260 KiB | 220 KiB | 815.9 / 249.8 / 211.1 KiB |
| standalone CSS | 42 KiB | 8.5 KiB | 7.2 KiB | 41.1 / 8.2 / 7.0 KiB |

A future intentional bundle increase must update these budgets in the same reviewed change rather than bypassing the check. Bundle growth should remain proportional to product capability; removing unused editor dependencies is part of the gate even when tree-shaking already keeps them out of the output.

Wall-clock serialization, startup, and RSS measurements continue to be recorded on every run. They are not converted into absolute shared-runner SLAs; the regression-tested runtime properties are structural instead: one page serialization per integration, cold-request coalescing, path-scoped registration, and deterministic cross-replica ETags.

## Canonical renderer parity

`packages/client/dist/standalone` is the renderer source of truth. Native adapters that commit packaged renderer assets are synchronized through `npm run sync:adapter-assets`; `npm run check:adapter-assets` and the language/framework workflows byte-compare those copies with a freshly built canonical renderer.

Do not hand-edit generated adapter bundles. A renderer change is complete only when the canonical client build succeeds and every committed native-adapter asset is synchronized from that build. The Performance Baseline artifact exists to make the canonical bytes inspectable/reusable in CI and release work; it does not replace the checked-in parity contract used by independently packaged adapters.

## Host overhead contract

FlexDoc must not add work to ordinary application API requests. Runtime integration registers documentation routes under the configured docs path; it does not install request processing on unrelated application routes. The Express regression suite asserts that every registered handler remains under the configured docs prefix and that no global middleware is installed. Host execution remains opt-in and does not create a background polling loop.

For the documentation path itself, the generated host page is immutable for the lifetime of the configured integration because its spec/options are already resolved once. Node hosts therefore serialize that page once, cache it, and reuse it for warm requests. The page is served with `Cache-Control: no-cache` plus an ETag so browsers and proxies can revalidate without transferring the HTML again when unchanged.

Renderer assets remain version-addressed and use `public, max-age=31536000, immutable`. ETags are content-derived, so independent application replicas serving the same spec/options produce the same validator without shared cache state; each replica keeps only its own in-process page promise/body.

## Deployment choices

The embedded mode optimizes for zero normal-route overhead and cheap docs requests. Teams that require literally zero FlexDoc runtime presence can continue to export/serve static documentation through the CLI or their static hosting pipeline.

Compression should normally be provided by the application's HTTP stack, ingress, CDN, or reverse proxy. The benchmark reports gzip/Brotli transfer sizes so operators can verify the expected compressed footprint without FlexDoc introducing a second compression layer inside every adapter.

## Production-readiness gate

The production-readiness contract now includes:

- a checked-in repeatable benchmark harness and CI artifacts;
- measured bundle and large-spec baselines;
- deterministic raw/gzip/Brotli bundle budgets for the current 3.0 renderer surface;
- a canonical standalone-renderer artifact plus byte-parity checks across committed native adapters;
- no repeated host-page serialization on warm docs requests, including coalesced concurrent cold requests;
- conditional revalidation for generated docs HTML with replica-stable content ETags;
- measured Node backend import/setup process and RSS cost;
- explicit production guidance for compression, caching, static deployment, multi-replica behavior, and normal API hot-path isolation;
- wall-clock metrics retained as non-blocking evidence rather than shared-runner SLAs.
