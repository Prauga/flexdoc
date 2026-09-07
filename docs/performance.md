# Performance and production readiness

FlexDoc 2.9.9 is the production-readiness gate before 3.0 Runtime Intelligence. The goal is to answer a simple operator question with measurements: **what does installing FlexDoc cost the service that hosts it?**

## What we measure

The repository owns a repeatable Node baseline through `npm run benchmark:performance` and the `Performance Baseline` GitHub Actions workflow.

The baseline records:

- canonical standalone JavaScript and CSS raw, gzip, and Brotli sizes;
- OpenAPI host-page serialization for approximately 100 KiB, 1 MiB, 5 MiB, and 10 MiB specifications, including p50/p95/p99;
- first render cost versus warm cached-page lookup cost and 100-request cold-cache coalescing;
- clean Node process startup versus FlexDoc backend import/setup time and RSS;
- generated host-page size and benchmark-process memory snapshot;
- the exact Node/platform metadata used for the run.

Workflow results are uploaded as `performance-results.json`. Wall-clock measurements remain evidence rather than hard CI budgets because shared runners are noisy. Deterministic bundle sizes are stable enough to gate now, so CI enforces explicit raw/gzip/Brotli ceilings through `npm run check:performance-budgets -- performance-results.json`.

## Regression budgets

The 2.9.9 baseline establishes intentionally small headroom above the repeated measured bundle sizes. A future intentional bundle increase should update these budgets in the same reviewed change rather than bypassing the check.

| Asset | Raw budget | Gzip budget | Brotli budget | Repeated baseline |
| --- | ---: | ---: | ---: | ---: |
| standalone JavaScript | 540 KiB | 160 KiB | 135 KiB | ~511 / 151 / 126.6 KiB |
| standalone CSS | 41 KiB | 8.2 KiB | 7 KiB | ~38.1 / 7.6 / 6.5 KiB |

Wall-clock serialization, startup, and RSS measurements continue to be recorded on every run. They are not converted into absolute shared-runner SLAs in 2.9.9; the regression-tested runtime properties are structural instead: one page serialization per integration, cold-request coalescing, path-scoped registration, and deterministic cross-replica ETags.

## Host overhead contract

FlexDoc must not add work to ordinary application API requests. Runtime integration registers documentation routes under the configured docs path; it does not install request processing on unrelated application routes. The Express regression suite asserts that every registered handler remains under the configured docs prefix and that no global middleware is installed. Host execution remains opt-in and does not create a background polling loop.

For the documentation path itself, the generated host page is immutable for the lifetime of the configured integration because its spec/options are already resolved once. Node hosts therefore serialize that page once, cache it, and reuse it for warm requests. The page is served with `Cache-Control: no-cache` plus an ETag so browsers and proxies can revalidate without transferring the HTML again when unchanged.

Renderer assets remain version-addressed and use `public, max-age=31536000, immutable`. ETags are content-derived, so independent application replicas serving the same spec/options produce the same validator without shared cache state; each replica keeps only its own in-process page promise/body.

## Deployment choices

The embedded mode optimizes for zero normal-route overhead and cheap docs requests. Teams that require literally zero FlexDoc runtime presence can continue to export/serve static documentation through the CLI or their static hosting pipeline.

Compression should normally be provided by the application's HTTP stack, ingress, CDN, or reverse proxy. The benchmark reports gzip/Brotli transfer sizes so operators can verify the expected compressed footprint without FlexDoc introducing a second compression layer inside every adapter.

## 2.9.9 completion gate

Before 3.0 work starts, FlexDoc should have:

- a checked-in repeatable benchmark harness and CI artifact;
- measured bundle and large-spec baselines;
- no repeated host-page serialization on warm docs requests, including coalesced concurrent cold requests;
- conditional revalidation for generated docs HTML with replica-stable content ETags;
- measured Node backend import/setup process and RSS cost;
- explicit production guidance for compression, caching, static deployment, multi-replica behavior, and normal API hot-path isolation;
- deterministic bundle-size regression budgets derived from repeated baseline output, with wall-clock metrics retained as non-blocking evidence.
