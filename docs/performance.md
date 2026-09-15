# Performance and production readiness

FlexDoc 2.9.9 established the production-readiness baseline before 3.0 Runtime Intelligence. The same operator question remains measurable as the renderer and backend-native execution surface grow: **what does installing FlexDoc cost the service that hosts it?**

## What we measure

The repository owns a repeatable Node baseline through `npm run benchmark:performance` and the `Performance Baseline` GitHub Actions workflow.

The baseline records:

- canonical standalone JavaScript and CSS raw, gzip, and Brotli sizes;
- OpenAPI host-page serialization for approximately 100 KiB, 1 MiB, 5 MiB, and 10 MiB specifications, including p50/p95/p99;
- first render cost versus warm cached-page lookup cost and 100-request cold-cache coalescing;
- clean Node process startup versus FlexDoc backend import/setup time and RSS;
- generated host-page size and benchmark-process memory snapshot;
- the exact Node/platform metadata used for the run.

Workflow results are uploaded as `performance-results.json`. Wall-clock measurements remain evidence rather than hard CI budgets because shared runners are noisy. Deterministic bundle sizes are stable enough to gate, so CI enforces explicit raw/gzip/Brotli ceilings plus the JavaScript raw-headroom policy through `npm run check:performance-budgets -- performance-results.json`.

The machine-readable policy is [`scripts/performance/performance-policy.json`](../scripts/performance/performance-policy.json). The `Performance Baseline` workflow runs for `main`, `3.3`, and `3.3.x` pull requests so maintenance work cannot bypass the bundle gate simply because it targets the patch line.

## Regression budgets

The original 2.9.9 baseline used a 540 / 160 / 135 KiB JavaScript ceiling. Subsequent Runtime Intelligence, API Client completion, CodeMirror, and 3.3 host-routing work legitimately increased the renderer footprint, but budget growth remains explicit rather than automatic.

The final 3.3 release-candidate renderer measured approximately **840.3 KiB raw / 256.2 KiB gzip / 216.2 KiB Brotli** for JavaScript and **42.0 / 8.3 / 7.1 KiB** for CSS. The current enforced ceilings are:

| Asset | Raw budget | Gzip budget | Brotli budget | 3.3 measured baseline |
| --- | ---: | ---: | ---: | ---: |
| standalone JavaScript | 842 KiB | 260 KiB | 220 KiB | 840.3 / 256.2 / 216.2 KiB |
| standalone CSS | 43 KiB | 8.5 KiB | 7.2 KiB | 42.0 / 8.3 / 7.1 KiB |

### Bundle-headroom policy

JavaScript budget changes are **trim first**. An accepted release candidate must retain at least **1 KiB of raw JavaScript headroom**. The budget checker now enforces that requirement rather than leaving it as a maintainer comment.

If an intentional product change cannot fit after reasonable trimming, increase the raw ceiling only by the smallest justified amount that restores the minimum headroom and document the feature cost in the reviewed change. A raw-size increase does **not** automatically justify changing gzip or Brotli ceilings; compressed-budget changes require their own measured evidence and review.

CSS remains ceiling-gated but does not currently have a separate minimum-headroom requirement. Any future minimum belongs in the machine-readable policy rather than being inferred from one release measurement.

Wall-clock serialization, startup, and RSS measurements continue to be recorded on every run. They are not converted into absolute shared-runner SLAs; the regression-tested runtime properties are structural instead: one page serialization per integration, cold-request coalescing, path-scoped registration, and deterministic cross-replica ETags.

## Host-impact regression governance

Native API-host execution has a separate ten-runtime Host Impact workflow and catastrophic-regression guardrails. Those thresholds are not product SLOs or cross-runtime rankings. The detailed rebaseline process lives in [`scripts/performance/host-impact/README.md`](../scripts/performance/host-impact/README.md).

A threshold rebaseline requires at least three successful complete matrix runs, one representative run recorded in threshold provenance, corroborating run IDs in review, an intentional-change rationale, and a fresh complete matrix after the policy change. The checker validates the machine-readable governance/provenance contract before applying numeric thresholds. A failed guardrail is therefore an investigation trigger, not permission to widen the threshold.

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
- deterministic raw/gzip/Brotli bundle ceilings plus an executable JavaScript headroom policy;
- a canonical standalone renderer plus byte-parity checks across committed native adapters;
- a ten-runtime Host Impact harness with provenance-bearing catastrophic-regression guardrails and a documented rebaseline process;
- no repeated host-page serialization on warm docs requests, including coalesced concurrent cold requests;
- conditional revalidation for generated docs HTML with replica-stable content ETags;
- measured Node backend import/setup process and RSS cost;
- explicit production guidance for compression, caching, static deployment, multi-replica behavior, and normal API hot-path isolation;
- wall-clock metrics retained as non-blocking evidence rather than shared-runner SLAs.
