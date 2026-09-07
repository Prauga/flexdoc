# FlexDoc product roadmap: 2.3.0 → 3.4

FlexDoc 2.3.0 was the last coordinated product release before the API Client workspace grew through several focused development milestones. Those milestone numbers described source-development slices; they were not separate published FlexDoc package releases. The coordinated product line moved directly from published **2.3.0** to published **2.8.0** after the 2.8 source definition of done was satisfied.

The current published coordinated product line is **2.9.5**. FlexDoc **2.9.9 is source-complete and prepared as the coordinated performance-readiness release candidate**; it remains unpublished until the matching `js/v2.9.9` release workflow completes successfully.

Ecosystem adapters remain independently versioned. `@prauga/flexdoc-client` and `@prauga/flexdoc-backend` carry the coordinated FlexDoc product version because they own and distribute the canonical renderer. Native adapters receive their own semantic-version increment when they package a new renderer, rather than being renamed to the product version.

## Development milestones

| Milestone | Product capability | Status in source |
| --- | --- | --- |
| **2.3.0** | broad backend/framework coverage on one canonical renderer | shipped |
| **2.4** | collection variables, nested folders, collection-aware history replay | complete |
| **2.5** | hierarchical collection/folder/request auth, OpenAPI auth handoff, OAuth access tokens, collection-variable scripting | complete |
| **2.6** | persisted post-response tests and script output in request history | complete |
| **2.7** | canonical Try It → API Client request sessions, inherit-first auth defaults, complete browser OAuth grant flows | complete |
| **2.8** | Postman import into the canonical standalone workspace and coordinated product-version catch-up | shipped |
| **2.9** | shared request executor, collection/folder runner product UI, scripting IntelliSense, grouped run history, and full request-history inspector | shipped |
| **2.9.5** | REST workspace parity hardening plus capability-gated Node API-host execution for browser-impossible request features | shipped |
| **2.9.9** | measured performance baseline, production delivery hardening, host-page caching/revalidation, and regression budgets before Runtime Intelligence | release candidate |

Viewer expansion defaults/settings and renderer-option parity landed before the 2.8 release and are included in the 2.8 product surface.

## Architecture rule

The standalone `ApiClientWorkspace` is the API-development product surface. Importers are adapters into its canonical workspace model; they must not introduce a Postman-specific request engine, persistence model, auth resolver, script executor, or history store.

Imported data should become ordinary FlexDoc collections, folders, requests, variables, environments, auth settings, and scripts immediately after conversion. Unsupported source behavior must produce an explicit warning instead of being silently reinterpreted.

## 2.9.0 shipped baseline

The published 2.9.0 line surfaces the collection runner in `ApiClientWorkspace` and completed its runner, history-inspector, and browser-hardening slices.

- `executeApiClientRequest` remains the shared request executor used by normal sends and collection/folder runs.
- `runApiClientCollection` remains a public API/core capability and now backs **Run collection** and **Run folder** controls in the workspace. The main runner view shows the exact queue, active environment, progress, HTTP status/timing, test outcomes, stop-on-failure, and an explicit Stop action.
- Folder runs include descendant folders. Execution order remains the current `workspace.requests` saved-request array order rather than folder-tree/UI order; the runner exposes that exact order before execution so it is not implicit.
- Runner `passed`/`failed` counts describe execution health: transport errors, script errors, or failed tests make an item fail. An HTTP status by itself does not, so an expected `4xx` response can pass a collection run. History continues to use inspector-oriented HTTP failure semantics, and grouped run history preserves the separate runner pass/fail result for clarity.
- Each collection/folder run receives a run ID and stable run label. History entries produced by that run persist the run ID, position, total, and runner outcome, allowing History to group the requests as one collection run while retaining per-request inspection and replay.
- User-initiated Stop aborts the active **fetch** through `AbortController`, marks that request cancelled, leaves later requests not run, and does not persist an incomplete cancelled request as a history row. Script execution itself is not interrupted by the Stop signal: a long-running pre-request or post-response test script continues until that script phase returns, and any collection/environment mutations it performs remain applied.
- New history entries persist response headers and response bodies locally in IndexedDB. History is bounded to 100 entries, and each stored response body is capped at 256 KiB. Response payloads can contain tokens, PII, or other sensitive data; users can remove individual entries or clear History to remove that persisted request data.
- A pre-request script error that occurs before a request result exists still does not append a history row. This matches the current single-request Send path; grouped history may therefore capture fewer rows than the run total and reports captured/total explicitly.
- While scripting IntelliSense suggestions are open, `Tab` or `Enter` accepts the active suggestion. `Escape` closes the popup and restores normal indentation/newline behavior.

Iteration-data files, CSV/JSON data-driven runs, concurrency controls, and drag-and-drop request ordering are intentionally outside this slice. The active workspace environment and saved-request order are used as-is.

## 2.9.5 parity hardening

2.9.5 keeps one canonical workspace/executor model while closing remaining REST-client gaps and beginning the backend-native execution moat.

- structured URL-encoded, multipart, GraphQL, and binary bodies remain first-class request-draft modes across editing, persistence, Postman import, history/replay, and execution;
- response inspection provides shared Pretty, Raw, and sandboxed Preview views;
- collection/folder/request auth now preserves Digest, Hawk, OAuth 1.0, AWS Signature V4, NTLM intent, and cookie API keys instead of flattening advanced imported auth into unsupported placeholders;
- the renderer selects browser or API-host transport from explicit capability requirements, and normal Send, OpenAPI Try It handoff, scripts/tests, history, and collection/folder runs continue through the same execution result pipeline;
- the Node backend can explicitly opt into controlled API-host execution for cookies, configured client certificates, Digest, Hawk, OAuth 1.0, and AWS Signature V4. NTLM remains represented but is not advertised by the Node executor;
- host execution is fail-closed: exact allowed origins, metadata/link-local blocking, same docs authentication, a required custom execution header, bounded request/response sizes and cookie sessions, and rejection of cross-origin redirects;
- renderer-only native adapters remain browser-only unless they explicitly advertise a host-execution capability. They still receive the same canonical renderer so unsupported host-only controls remain visibly unavailable instead of silently degrading.

This is deliberately the first narrow backend-execution slice, not the end of the backend-native roadmap. Headless CI execution, richer runtime-derived context, and cross-adapter private-network execution remain later work.

See [`host-execution.md`](./host-execution.md) for the execution/security contract and [`postman-import.md`](./postman-import.md) for advanced-auth import behavior.

## 2.9.0 definition of done

The 2.9 source release candidate is complete with the following satisfied:

- [x] normal Send and collection/folder execution share the canonical `executeApiClientRequest` engine
- [x] collection and folder runs are user-facing workspace controls with explicit saved-request execution order, progress/results, stop-on-failure, and Stop
- [x] run history groups requests by stable run metadata while preserving per-request inspection and replay
- [x] the full History inspector supports search/filtering, persisted response headers/bodies, tests/logs, replay, deletion, and bounded IndexedDB persistence
- [x] scripting IntelliSense is phase-aware, exposes live variable keys and assertion-chain help, and is exercised through real Chromium keyboard interactions
- [x] runner-vs-History failure semantics, fetch-only cancellation, pre-request-error history behavior, ordering, and local response-body persistence are documented explicitly
- [x] coordinated client/backend source versions advance to `2.9.0`; renderer-consuming native packages advance on their independent semantic-version lines while core and CLI remain unchanged
- [x] future-version example manifests and the deterministic future-tag Go checksum represent the release-candidate source tree without pretending registry artifacts already exist
- [x] the canonical standalone renderer is rebuilt and synchronized across committed adapter assets, with parity checks passing before the release candidate is proposed

2.9.0 and 2.9.5 are published. 2.9.9 is now prepared as the final 2.x performance-readiness release candidate.

## 2.8.0 definition of done

The 2.8 release is complete with all of the following satisfied:

- [x] standalone API Client workspace is a public client API and works without an OpenAPI document
- [x] local collections, collection variables, arbitrary-depth folders, saved requests, environments, and bounded history persist in IndexedDB
- [x] collection/folder/request auth inheritance supports No Auth, bearer, Basic, API keys, and OAuth 2.0
- [x] OAuth supports manual tokens plus Authorization Code with PKCE, Client Credentials, Password, Implicit, and explicit refresh-token reuse
- [x] pre-request scripts, post-response tests, collection/environment mutation, logs, and persisted test outcomes use the shared `flex.*` runtime
- [x] OpenAPI Try It hands a canonical editable request session to the same workspace rather than a parallel request representation
- [x] Postman Collection v2.1 JSON imports collections, nested folders, requests, common auth, variables, supported body modes, and compatible scripts into the canonical workspace
- [x] Postman environment JSON imports named environment variables and integrates with normal variable precedence
- [x] unsupported Postman auth/script/body behavior is surfaced as an import warning rather than silently treated as equivalent
- [x] the browser import workflow accepts collection and environment files together and imported state survives reload
- [x] coordinated source versions and example pins represent the published 2.8.0 release line
- [x] canonical standalone renderer assets are rebuilt and synchronized into every adapter that embeds them
- [x] unit, build, browser E2E, adapter parity, framework coverage, and package/version guards are green on the exact final source head

## 2.9.9 Performance & production readiness

2.9.9 is intentionally the final 2.x engineering gate before Runtime Intelligence. It does not reopen Postman/Scalar parity work. It establishes measurable production cost, removes avoidable documentation-host overhead, and turns performance into a regression-tested property of the product.

Definition of done:

- [x] benchmark 100 KiB, 1 MiB, 5 MiB, and 10 MiB OpenAPI documents on a repeatable harness
- [x] record canonical renderer raw/gzip/Brotli size and enforce deterministic bundle-size regression budgets in CI
- [x] serialize generated Node host pages once per configured integration instead of once per docs request
- [x] support ETag-based docs-page revalidation while preserving `no-cache` freshness semantics
- [x] measure Node process startup, backend import/setup time, and RSS delta in clean child processes
- [x] verify normal application routes incur no FlexDoc request-path work through path-scoped integration regressions
- [x] document compression, caching, replica-stable ETags, multi-pod/process-local cache behavior, and detached/static deployment guidance

The architectural priority test remains unchanged: **could Scalar implement this without being installed inside the backend?** Performance work is justified here because backend installation is part of FlexDoc's differentiation; the cost of that installation must be explicit, small, and continuously measurable.

## Backend-native roadmap after 2.9.9

FlexDoc should differentiate through information and actions available because it is installed **inside the running backend**, not by indefinitely chasing generic hosted-docs or API-client parity. The prioritization question for major roadmap work is:

> **Could Scalar implement this without being installed inside the backend?**

If the answer is yes, the feature may still be useful, but it does not receive the same differentiation priority as backend-native capabilities. The next product sequence is:

| Milestone | Direction | Core outcome |
| --- | --- | --- |
| **3.0 — Runtime Intelligence** | understand the running service | runtime route discovery, OpenAPI ↔ implementation drift detection, framework/runtime metadata, and runtime server/environment discovery |
| **3.1 — Contract Validation** | turn runtime knowledge into enforcement | spec-vs-implementation validation, undocumented/missing routes, method/path/schema mismatches, breaking drift, and CI/development feedback |
| **3.2 — FlexDoc Runner** | take the canonical API execution model headless | collection/folder execution outside the browser, CI execution, machine-readable reports, and the same request/script semantics as the embedded client |
| **3.3 — Backend Execution Expansion** | expand execution from the service/network context | carry the 2.9.5 controlled Node executor across relevant adapters, deepen internal/VPC/private-endpoint workflows, remove remaining browser-only constraints, and reuse backend-known runtime/environment context safely |
| **3.4 — Service Workbench** | evolve from API docs into a service workbench | runtime diagnostics, request/tracing context, framework-aware introspection, and deeper service debugging surfaces |

Cloud collaboration, teams, enterprise controls, CI workflow, and additional protocol/agent surfaces remain valid later directions, but they should build on this backend-native moat rather than displace it. The embedded product remains self-hostable with one canonical renderer and no required FlexDoc account, hosted service, telemetry dependency, or runtime CDN.

## Release interpretation

Do not retroactively publish artificial 2.4.0, 2.5.0, 2.6.0, or 2.7.0 releases just to fill the numeric gap. They are recorded here as development milestones. The coordinated JavaScript product line moved through published **2.8.0**, **2.9.0**, and **2.9.5**. FlexDoc **2.9.9** is the final 2.x performance-readiness release candidate before 3.0 and remains unpublished until the `js/v2.9.9` release workflow completes successfully.

For native adapters, each package remains on its independently versioned semantic-release line while carrying the current coordinated renderer. `@prauga/flexdoc-core` remains independently versioned unless the framework-neutral engine itself changes. The CLI also remains independently versioned and consumes the coordinated client line.
