# FlexDoc 3.3 / Service Workbench
## Product, Security, Platform & Commercial Strategy

**Working strategy — 15 September 2026**  
**Project:** Prauga FlexDoc  
**Repository:** `Prauga/flexdoc`  
**Published coordinated product line:** 3.3.0 — published 15 September 2026  
**Current work:** 3.3.x post-release hardening, transport/privacy UX completion, and Service Workbench preparation  

> **Core thesis**  
> FlexDoc should not compete as “another beautiful OpenAPI renderer” or “a smaller hosted documentation platform.” Its durable advantage is that it can be installed inside the running backend and use that position to expose capabilities that a document-only or hosted tool cannot reliably reproduce: runtime truth, implementation-versus-contract evidence, controlled execution from the service network, framework-aware diagnostics, and eventually a service workbench. The open-source embedded product remains the distribution wedge; cloud collaboration and fleet-level intelligence should build on that moat rather than replace it.

---

# 0. Document map

This document replaces the 30 August 2026 FlexDoc Product, Security & SaaS Transformation Strategy. It is a full current-state strategy, not a delta. It records what has shipped, what remains incomplete in post-release hardening, and what the next product milestones should be.

| Section | Purpose |
|---|---|
| 1 | Executive decision, current position, product thesis, engine-status baseline and canonical milestone sources |
| 2 | Current product state and completed work through the shipped 3.3 release |
| 3 | Ongoing work and release boundary |
| 4 | Product feature strategy and the backend-native prioritization model |
| 5 | Security model and updated threat register |
| 6 | Current and target architecture, including future cloud boundaries |
| 7 | Platform engineering, performance, CI/CD and operations |
| 8 | Packaging, licensing, monetization and commercial model |
| 9 | Roadmap from shipped 2.8–3.2 foundations through 3.3, Service Workbench and later platform horizons |
| 10 | Prioritized backlog and launch gates |
| 11 | Metrics, go-to-market and open-source growth loop |
| 12 | Competitive benchmark and differentiation, with Scalar as the closest reference point |
| 13 | Decision log and final recommendation |
| Appendix A | Milestone ledger and old-audit disposition |
| Appendix B | 3.3 runtime/package coverage |
| Appendix C | Security checklist for future features |

---

# 1. Executive decision

## 1.1 Current position

The original August strategy correctly identified that FlexDoc needed a trustworthy shared engine before SaaS. That refoundation has now happened much faster and more completely than the old document anticipated.

The project is no longer a duplicated renderer with a shallow “Try It” concept. FlexDoc now has one canonical renderer, a standalone API Client workspace, persistent collections and environments, scripting and tests, Postman import, collection execution, a headless runner, Runtime Intelligence, Contract Validation, broad backend/framework packaging, performance regression gates, and controlled backend-network execution.

The coordinated JavaScript product line reached **3.3.0 on 15 September 2026**. Backend Execution Expansion is now a published product capability rather than a release candidate. The coordinated release includes the JavaScript line plus independently versioned native adapters, with the published 3.3 matrix anchored by `js/v3.3.0` and the corresponding native ecosystem releases.

The immediate product phase is **3.3.x post-release hardening and UX completion**: preserve per-PR generated-renderer parity, close remaining HTTP-boundary/security gaps, finish transport guidance, review first-release host-execution observations, and convert the prose backlog into GitHub-tracked work before 3.4 expands scope.

The strategic consequence remains important: **FlexDoc should not pivot immediately into a generic multi-tenant docs SaaS simply because the engine is now credible.** The stronger opportunity is to deepen the backend-native product moat first, then add cloud/fleet workflow around it.

## 1.2 Recommended product thesis

### Positioning

**FlexDoc is a backend-native API workbench that starts with excellent OpenAPI documentation and API exploration, then adds runtime truth, contract validation, backend-network execution and service diagnostics from inside the application.**

The embedded product should continue to work without a FlexDoc account, without required telemetry, without a hosted control plane and without a runtime CDN. The same canonical renderer and request model should remain portable across backend adapters, standalone browser use, static/detached delivery and headless execution.

### The feature gate

Every major roadmap proposal should be tested against this question:

> **Could Scalar implement this feature with essentially the same value without being installed inside the backend?**

If the answer is **yes**, the feature is probably parity, convenience or table stakes. Build it only when it materially improves activation, compatibility, retention or the usability of the backend-native features.

If the answer is **no**, or the backend installation creates materially better evidence, network reach, safety or workflow, the feature belongs near the top of the roadmap.

This does not mean generic capabilities are unimportant. FlexDoc still needs a strong API reference, API Client, search, authentication, collections, imports and headless automation. It means those features support the moat; they are not the moat themselves.

## 1.3 What changed since the August strategy

The following August assumptions are now obsolete or materially changed:

| August assumption | Current reality |
|---|---|
| Two independent renderers were the largest architectural blocker | A canonical standalone renderer is now the source of truth and adapter assets are parity-checked |
| “Try It” was missing | FlexDoc now has a full API Client workspace with environments, auth, scripting, history, collections, runners and advanced body modes |
| OpenAPI support was shallow and unsafe | OpenAPI 3.0/3.1 compatibility is now tracked by a fixture corpus with tested local/external refs, cycles, serialization, security, bodies and schema composition; some edge features remain explicitly partial |
| Framework support was mostly Node/Nest-centric | The product now spans Node, Python, Java/JVM, .NET, Go, Rust, Ruby, Elixir and PHP runtime families |
| Product planning could still be anchored on the first few open PRs from the August audit | The active product line is **2.8 → 3.3**: 2.8, 2.9, 2.9.5, 2.9.9, 3.0, 3.1 and 3.2 are shipped; 3.3 is the current release boundary |
| Static/hosted docs were the primary product direction | The roadmap now prioritizes Runtime Intelligence, Contract Validation, backend execution and Service Workbench capabilities |
| Cloud Alpha was the obvious next phase after engine stabilization | Cloud remains valid, but should follow a deeper backend-native moat instead of interrupting it |
| “Mounted inside the backend” by itself was a sufficient differentiation claim | Scalar also supports mounting inside many frameworks; FlexDoc must differentiate by exploiting runtime/service context, not merely by where the renderer is served |
| Performance and production cost were future concerns | Bundle budgets, large-spec benchmarks, host-page caching, ETags, normal-route isolation and ten-runtime host-impact measurements are now permanent regression surfaces |
| Package identity was still tied to the old personal scope | The product is now under Prauga, with `@prauga/flexdoc-client`, `@prauga/flexdoc-backend` and a Prauga GitHub repository |

For milestone planning, the canonical product references are now **`docs/api-client-roadmap.md`** for the living product sequence and **`docs/releases/3.3.md`** for the 3.3 release contract. This strategy should summarize and prioritize those milestones, not drift into a competing source of truth.

## 1.4 Strategic decisions

| Decision | Current recommendation | Reason |
|---|---|---|
| Product category | Backend-native API workbench | Stronger and more defensible than “API docs renderer” |
| Core architecture | Preserve one renderer, one canonical API Client/request model and additive backend contracts | Prevents drift and duplicate execution/auth semantics |
| Next major product milestone | 3.4 Service Workbench | Converts backend installation into daily engineering value |
| Cloud timing | Defer full SaaS build until backend-native value is deeper and repeatable | Avoids spending limited engineering capacity on undifferentiated hosting/control-plane work |
| Runtime access | Explicit, capability-advertised and fail-closed | Backend reach is valuable but security-sensitive |
| Native package versions | Independent ecosystem semver; coordinated product compatibility documented separately | Avoids artificial synchronized versioning across languages |
| AI | Later, permission-aware layer on top of strong structured/runtime context | AI is not the moat and competitors already bundle it |
| Licensing | Keep current AGPL posture for now; revisit only with a deliberate commercial/embedding decision | The project is now under Prauga and commercial packaging should be intentional, not accidental |
| Telemetry | No required telemetry in self-hosted packages | Trust and self-hostability are part of the product promise |

## 1.5 Current maturity assessment

The old document used numerical maturity scores. That precision is no longer useful; the product has several distinct mature surfaces and several intentionally unbuilt commercial surfaces. The current planning assessment is:

| Area | Current status | Notes |
|---|---|---|
| Canonical renderer / API reference | Mature product surface | One canonical bundle, adapter parity checks, performance budgets |
| OpenAPI 3.0/3.1 fidelity | Strong with explicit partials | Compatibility matrix is test-backed rather than blanket “full support” marketing |
| API Client / request execution | Strong | Collections, auth, scripting, history, runner, Postman import, advanced bodies |
| Headless automation | Shipped baseline | 3.2 Runner provides portable request/folder/collection execution and CI reports |
| Runtime Intelligence | Shipped baseline | 3.0 live route discovery and runtime context across major frameworks |
| Contract Validation | Shipped first slice | 3.1 operation-level implementation drift; deeper schema/traffic validation remains future work |
| Backend host execution | Shipped in 3.3 | Controlled native execution across the supported runtime families; 3.3.x hardening continues |
| Framework breadth | Strong | Multiple native ecosystems; some runtime-introspection depth still differs by framework |
| Security engineering | Stronger, still active | Fail-closed host execution and negative tests exist; server-side egress remains a privileged surface requiring deployment controls |
| Performance / production readiness | Strong baseline | Deterministic bundle budgets and cross-runtime host impact are regression-tested |
| Service diagnostics/workbench | Planned | 3.4 is the next major product direction |
| Hosted multi-tenant platform | Mostly unbuilt | Intentionally deferred; architecture strategy remains available when justified |
| Enterprise controls | Future | SSO/SCIM/RBAC/audit/fleet governance belong to later cloud/enterprise layers |

## 1.6 Engine status, launch gate and canonical milestone sources

Product status must be read from the **2.8 → 3.3 engine line**, not from the August-era PR #1–#5 audit stack. The current planning baseline is explicit:

- **2.8.0 — shipped:** standalone API Client workspace, Postman import and coordinated product catch-up;
- **2.9.0 / 2.9.5 / 2.9.9 — shipped:** shared execution, collection/folder runner UI, Node API-host execution and production/performance hardening;
- **3.0.0 — shipped:** Runtime Intelligence;
- **3.1.0 — shipped:** Contract Validation, with the first backend-produced evidence slice on Node;
- **3.2.0 — shipped:** `flexdoc-runner` / portable headless request, folder and collection execution for CI;
- **3.3.0 — shipped 15 Sep 2026:** cross-runtime native host execution, interactive `preferHostExecution`, operations/security guidance and Host Impact regression coverage.

The **OSS 3.3 launch gate** is a first-class milestone: native `__flexdoc/execute` on the supported runtime matrix; interactive `preferHostExecution` behavior covered by regression tests; host-execution operations/security guidance complete; Host Impact baseline green; artifacts, examples, changelog and release notes consistent with the published commit.

The canonical milestone references are **`docs/api-client-roadmap.md`** for the living product sequence and **`docs/releases/3.3.md`** for the 3.3 release contract. This strategy owns prioritization and cross-cutting sequencing; it must not become a competing implementation-status ledger.

## 1.7 Things not to build yet

The old “do not build yet” list still mostly holds, with one important change: FlexDoc has already built a serious API Client and headless runner, so generic REST-client parity should now be treated as a maintenance surface rather than the main roadmap.

Do not make a visual page editor, general CMS or marketing-site builder the next major initiative. Do not prioritize AI chat over structured runtime/service context. Do not build a custom identity provider. Do not turn host execution into a generic proxy. Do not chase every protocol before the REST/OpenAPI backend-native loop is clearly valuable. Do not create a cloud architecture that requires the self-hosted product to phone home. Do not add backend instrumentation that imposes meaningful hot-path overhead without a measured, explicit operator contract.

---

# 2. Current product state and completed work

## 2.1 Milestone ledger

The coordinated product has evolved through a series of source milestones. Some 2.x numbers represented development slices rather than independently published package releases.

| Milestone | Capability | Current state |
|---|---|---|
| 2.3.0 | Broad backend/framework coverage on one canonical renderer | Shipped |
| 2.4 | Collection variables, nested folders, collection-aware history replay | Complete source milestone |
| 2.5 | Hierarchical auth, OpenAPI auth handoff, OAuth access tokens, collection-variable scripting | Complete source milestone |
| 2.6 | Persisted post-response tests and script output in request history | Complete source milestone |
| 2.7 | Canonical Try It → API Client sessions, inherit-first auth, browser OAuth grant flows | Complete source milestone |
| 2.8.0 | Standalone API Client, Postman import, coordinated product catch-up | Shipped |
| 2.9.0 | Shared executor, collection/folder runner UI, grouped run history, history inspector, scripting IntelliSense | Shipped |
| 2.9.5 | REST-client parity hardening + capability-gated Node API-host execution | Shipped |
| 2.9.9 | Performance baseline, caching/revalidation, production-readiness budgets | Shipped |
| 3.0.0 | Runtime Intelligence and product-quality completion gate | Shipped |
| 3.1.0 | Backend Contract Validation with renderer/CLI consumption | Shipped |
| 3.2.0 | Portable headless FlexDoc Runner with CI-oriented reports | Shipped 8 Sep 2026 |
| 3.3.0 | Native backend execution expansion across runtime families | **Shipped 15 Sep 2026** |
| 3.4 | Service Workbench | Planned next major milestone |

## 2.2 Canonical renderer and product architecture

FlexDoc now follows a substantially cleaner architecture than the August review described.

The **canonical standalone renderer** is the source of truth. Native adapters that package renderer assets are synchronized from that build and verified for byte parity. Adapter-specific presentation implementations should not emerge again.

The **standalone `ApiClientWorkspace`** is the API-development product surface. Postman and OpenAPI handoffs are adapters into the same workspace model rather than separate clients. Collections, folders, saved requests, environments, auth, scripts, tests and history share the same request model and persistence semantics.

The **shared request executor** is reused by normal interactive sends and collection/folder execution. Headless execution in 3.2 carries the same canonical model outside the browser rather than inventing a second CLI-specific request language.

Backend capabilities are exposed through explicit additive contracts such as runtime intelligence, validation and host execution. The renderer consumes capability data instead of hard-coding framework-specific UI behavior.

This architecture is now one of FlexDoc’s most important assets. Future work should extend it rather than fork it.

## 2.3 OpenAPI compatibility

FlexDoc targets **OpenAPI 3.0.x and 3.1.x**, but the project now explicitly avoids blanket “full support” claims. Compatibility is tied to automated fixtures.

Tested areas include JSON/YAML parsing, local JSON Pointer refs, external and nested refs, circular external refs, root-reference rewrites, recursive components, parameter merging, referenced request/response objects, server precedence and variables, query/path/header/cookie serialization, `allowReserved`, bearer/basic/API key/OAuth token injection, AND/OR security requirements, JSON/form/multipart bodies, schema composition, nullable behavior and key JSON Schema concepts.

Important current partials and constraints include:

- nested `deepObject` structures are not recursively expanded;
- binary file picking for multipart is not yet a first-class UI flow;
- dedicated renderer UI for `patternProperties` and JSON Schema conditionals is partial;
- discriminators are retained but do not yet have dedicated visualization;
- OpenAPI 3.1 webhooks are represented but are not a first-class navigation surface;
- callbacks are represented but not yet a first-class interactive surface;
- OpenAPI Links are not yet owned as a first-class compatibility/interaction row; callbacks, links and webhooks should each have explicit matrix ownership;
- XML metadata is retained, while request generation remains primarily JSON/form oriented.

The compatibility principle should remain: **move a capability to “tested” only when a regression fixture proves the behavior.**

## 2.4 API Client and interactive workspace

The old strategy treated a real API explorer as a future P0. It is now a substantial product in its own right.

The current workspace includes:

- standalone use without requiring an OpenAPI document;
- persistent collections, arbitrary-depth folders, saved requests, environments and bounded history in IndexedDB;
- collection, folder and request auth inheritance;
- No Auth, bearer, Basic, API key and OAuth 2.0 flows, plus preservation/handling of advanced imported auth intent such as Digest, Hawk, OAuth 1.0, SigV4, NTLM intent and cookie API keys;
- Authorization Code with PKCE, Client Credentials, Password, Implicit and refresh-token reuse where supported by the browser flow;
- canonical OpenAPI Try It handoff into editable request sessions;
- pre-request scripts and post-response tests using the shared `flex.*` runtime;
- collection/environment mutation from scripts;
- structured URL-encoded, multipart, GraphQL and binary request body modes;
- Pretty, Raw and sandboxed Preview response inspection;
- persisted response headers/bodies, logs and test outcomes;
- collection/folder execution with queue visibility, progress, stop-on-failure and cancellation;
- grouped run history and replay;
- phase-aware scripting IntelliSense;
- Postman Collection v2.1 and environment import into the canonical workspace model.

The product rule remains that imports must become ordinary FlexDoc state. Unsupported source behavior should produce warnings rather than silently changing meaning.

## 2.5 FlexDoc Runner — shipped in 3.2

3.2 takes the canonical API Client execution model headless. This is strategically important because it connects interactive debugging to CI/automation without introducing a second execution model.

The shipped baseline supports portable execution of request, folder and collection scopes; reuse of canonical request/auth/script semantics; CI-oriented machine-readable output; and a clean separation between direct transport and host execution. Reusable/headless execution intentionally remains direct by default unless host semantics are explicitly selected or required.

The Runner is now a foundation for future contract checks, internal-service automation and cloud/fleet workflows. It should remain compatible with the browser workspace rather than becoming a separate test product.

## 2.6 Runtime Intelligence — shipped in 3.0

Runtime Intelligence is the first major expression of the backend-native moat.

The 3.0 baseline includes:

- an explicit runtime endpoint under the configured docs path;
- live route discovery for Node integrations including Express, Fastify, NestJS and Hono;
- live FastAPI/Starlette route discovery;
- ASP.NET Core endpoint discovery;
- Spring MVC request-mapping discovery;
- framework/runtime metadata and request-derived server origin;
- safe listener/environment context where trustworthy standards exist;
- explicit partial-discovery semantics rather than fabricated route information;
- a canonical renderer panel consuming one additive contract.

Go runtime discovery remains a deliberate area for further design because the neutral Go adapter sits above multiple router ecosystems with different introspection APIs. The project should continue to prefer truthful packaging boundaries over reflection-heavy claims.

## 2.7 Contract Validation — shipped in 3.1

3.1 turns runtime knowledge into structured backend-produced evidence.

The first slice focuses on operation-level implementation drift and includes stable finding categories for:

- runtime operations that are undocumented;
- documented operations that are not observed at runtime;
- method mismatches;
- duplicate runtime operations where the framework evidence is trustworthy.

Validation derives pass/warn/fail/partial states and accounts for incomplete discovery. Route identity is normalized so framework path-parameter naming differences do not create false drift.

The renderer can navigate from findings to documented operations when appropriate, and the CLI can consume the backend result through `flexdoc validate`, including JSON output, request headers/auth and configurable failure policy.

Explicitly **not yet part of the 3.1 baseline**: request/response schema validation, live-traffic breaking-drift policy, request rejection, generic OpenAPI linting or full cross-framework parity of every validation evidence type. These are candidates for post-3.4 contract intelligence, not reasons to dilute the current truthful scope.

## 2.8 Backend execution — from 2.9.5 to the shipped 3.3 release

2.9.5 introduced a narrow Node host-execution capability for browser-impossible features. 3.3 generalizes the idea into a cross-runtime backend execution layer.

When an integration explicitly enables host execution and supplies an exact-origin allowlist, an adapter can expose a docs-scoped execution route at `POST <docsPath>/__flexdoc/execute`. The interactive API Client prefers an available host for ordinary browser sends through `preferHostExecution`; the renderer remains the same while the transport changes from browser-direct to browser → API host → target.

This materially changes what FlexDoc can do:

- reach internal/VPC/private endpoints visible to the backend but not the browser;
- avoid browser CORS constraints for approved targets;
- provide controlled backend execution without creating a separate request model;
- preserve advanced host-only semantics where the adapter explicitly advertises capability support;
- give future Service Workbench features a safe, canonical mechanism for backend-context actions.

`capabilities: []` is a valid state: basic host transport is available, while advanced host-only capabilities are not. It must not be interpreted as “host execution disabled.” The UI should make that state positively understandable — “runs from your API server” — rather than only surfacing host execution when an advanced capability exists.

The next UX layer is transport transparency and policy: show Browser vs API host vs host-required execution, allow explicit per-request preference where safe, expose capability explanations, and make server-serialized `hostExecution.preferHostExecution` available as the future policy hook for centrally managed deployments.

## 2.9 Framework and runtime coverage

The 3.3 source tree covers native host execution across the following families:

- Node / JavaScript server integrations;
- Spring/JVM and JAX-RS;
- Python FastAPI/ASGI;
- Go `net/http`-style integration;
- ASP.NET Core;
- Rust Axum;
- Rust Actix;
- Ruby Rack/Rails;
- Elixir Plug/Phoenix;
- PHP with Laravel and Symfony integration paths.

The product should continue to distinguish **renderer coverage**, **host-execution coverage**, **runtime discovery coverage** and **contract-validation coverage**. A framework can support the canonical renderer without supporting every backend-native capability. Marketing and compatibility matrices should make those layers explicit.

## 2.10 Packaging, namespace and release quality

The project now lives under **Prauga** rather than the previous personal namespace.

The coordinated JavaScript product packages are:

- `@prauga/flexdoc-client`
- `@prauga/flexdoc-backend`

The repository is `Prauga/flexdoc`. Native language adapters retain independent 0.x semantic-version tracks. The coordinated product release identifies the compatible source/contract set; it should not force Python, Java, .NET, Rust, Ruby, Elixir, PHP and Go packages to share the JavaScript product version.

The release process now has GitHub releases, renderer artifacts, parity checks and coordinated examples. This is a major improvement over the August state where package metadata, documentation and release mechanics were themselves trust problems.

## 2.11 Performance and production readiness

2.9.9 established a permanent performance contract. FlexDoc now measures both renderer cost and hosting impact.

The baseline includes:

- repeatable 100 KiB, 1 MiB, 5 MiB and 10 MiB OpenAPI host-page benchmarks;
- standalone JavaScript/CSS raw, gzip and Brotli measurements;
- deterministic bundle-size regression budgets;
- one-time Node host-page serialization per configured integration;
- cold-request coalescing;
- ETag-based docs-page revalidation with replica-stable content validators;
- clean-process Node startup/import/setup/RSS measurement;
- tests proving normal application routes do not incur FlexDoc request-path work;
- canonical renderer artifact parity across adapters.

The 3.0 measured renderer baseline was approximately **815.9 KiB raw / 249.8 KiB gzip / 211.1 KiB Brotli JavaScript** and **41.1 / 8.2 / 7.0 KiB CSS**, with narrow enforced budgets above those values. 3.3 required only a very small raw-JavaScript ceiling adjustment for routing growth while compressed budgets remained unchanged.

3.3 adds a permanent **ten-runtime Host Impact Baseline** comparing matched direct and host-active workloads across Node, Java/Spring, Python, .NET, Go, Rust/Axum, Rust/Actix, Ruby, Elixir and PHP. It tracks latency, throughput, CPU/request, RSS/PSS and cooldown retention. Managed-runtime PSS is interpreted as directional evidence rather than literal live-object accounting.

This is a strong product principle: because FlexDoc is installed inside the service, **the cost of installation must remain explicit, small and continuously measurable.**

## 2.12 Disposition of the August critical findings

The August audit is now best treated as historical input rather than the active backlog.

| Old finding | Current disposition |
|---|---|
| Two independent renderers | Resolved architecturally through the canonical renderer/parity model |
| Missing real Try It | Resolved; API Client is now a major product surface |
| Shallow OpenAPI behavior | Materially resolved; compatibility corpus exists, with remaining partials documented honestly |
| Recursive ref risk | Materially resolved through cycle-safe compatibility behavior |
| Input mutation / ad hoc normalization | Superseded by the current canonical model and regression corpus; continue immutable-behavior discipline |
| `specUrl`/remote refs | External refs are supported with explicit browser/CORS constraints and programmatic loaders |
| Theme/config drift | Superseded by canonical renderer options and parity checks |
| Weak navigation/search/mobile | Product-quality work landed before 3.x; continue normal UX maintenance rather than treat as architecture blockers |
| Ad hoc code generation | Canonical request/session model now drives execution; language snippet breadth remains ordinary product work |
| Broken README/package/release trust | Materially improved through Prauga migration, current packages, examples, GitHub releases and CI guards |
| Runtime CDN/supply-chain dependency | Canonical bundled renderer is the product contract; no required runtime CDN should be reintroduced |

---

# 3. Ongoing work and post-release hardening

## 3.1 3.3 published status

FlexDoc **3.3.0 shipped on 15 September 2026**. GitHub release `js/v3.3.0` is published, alongside the coordinated native runtime release matrix for Java, .NET, Python, Ruby, Go, Rust/Actix, Elixir and the other supported adapter lines. The 3.3 launch boundary therefore no longer depends on PR #93 merge approval.

The product contract that matters after publication is the shipped behavior: native `__flexdoc/execute`, interactive host-routing policy, explicit capability advertisement, fail-closed security controls, operations guidance, and permanent host-impact regression coverage. `docs/releases/3.3.md` remains the release contract; `docs/api-client-roadmap.md` remains the living implementation sequence.

The active engineering boundary is now **3.3.x hardening and UX completion**. Current work is intentionally additive: renderer-asset parity on every client-changing PR, host-execution protection/admission consistency, HTTP-boundary conformance, transport diagnostics/guidance, post-release observation, and release-version follow-ups. No open hardening PR should be treated as already shipped merely because it is stacked on the published 3.3 line.

### Tracking rule introduced after 3.3

Every named `R33-*`, `HX-*`, `UX-*`, `OBS-*` or `PRH-*` item that remains open must have a GitHub tracking issue (or an explicitly linked implementation PR) rather than survive only as prose in this document. The strategy owns priority and sequencing; GitHub owns executable status. This is intended to stop hardening work from being repeatedly rediscovered through review.

## 3.2 3.3 hardening completed during review

Review work already addressed several release-quality concerns:

- a deterministic raw-JavaScript bundle ceiling miss was corrected narrowly without loosening compressed budgets;
- Python JSON/multipart envelope parsing was moved off the ASGI event-loop thread while preserving bounded async receipt;
- Laravel host execution now fails closed when enabled through the ServiceProvider without an application middleware boundary;
- Symfony received concrete firewall/CSRF guidance;
- the JVM executor has bounded worker and queue limits;
- Spring has a real MockMvc execute-route security boundary suite;
- Axum and Actix have dedicated fail-closed host-execution security contract suites;
- the client has a regression proving `available: true` with `capabilities: []` is a valid ordinary host transport;
- Markdown changes are covered by a lightweight Docs Contract workflow;
- Host Impact Baseline is now a coarse regression gate, not merely an artifact collector;
- Rust Axum/Actix executor sources are kept byte-identical through a parity workflow rather than introducing a third crate at the release boundary.

## 3.3 Post-publish completion gate

The 3.3 release itself is shipped. Remaining work must therefore be evaluated as post-release hardening, patch/minor adapter follow-up, or future product scope rather than as a reason to retroactively reopen the 3.3 launch decision.

Post-publish completion now means:

1. every client-changing 3.3.x PR carries an exact per-PR canonical renderer refresh across vendored adapters;
2. final PR heads have fresh CI/check evidence rather than inheriting stale or absent runs;
3. security-boundary gaps found after release are closed with HTTP-level conformance where appropriate;
4. package/example pins move only after replacement adapter artifacts are actually public;
5. first-release host-execution latency, rejection, CPU, memory-cooldown and transport-mix evidence is reviewed under `R33-07`;
6. open UX/HX/PRH work is represented by GitHub tracking issues rather than prose-only backlog entries.

## 3.4 3.3.x host-execution hardening

The following work should follow the release immediately and carry explicit milestone IDs rather than remain as prose-only operational advice:

| ID | Priority | Work | Done when |
|---|---|---|---|
| HX-01 | High | `@prauga/flexdoc-backend` admission-control helper | Reusable in-flight cap returns deterministic 429 behavior and can be mounted before execute handling |
| HX-02 | High | Laravel `LaravelFlexDoc::register()` fail-closed parity | Direct registration enforces the same middleware-boundary rule as the ServiceProvider when host execution is enabled |
| HX-03 | High | Symfony firewall/middleware fail-closed contract | Host execution cannot be enabled without an explicit, tested application auth/firewall boundary; integration guidance is executable rather than prose-only |
| HX-04 | Medium | Shared Rust executor decision | Axum/Actix host execution moves to a shared crate, or an ADR records why duplication is retained and what ends the parity-`cmp` stopgap |
| HX-05 | High | Python ASGI threading completion | Invalid-marker handling and large-body reads no longer leave avoidable blocking work on the event loop |
| HX-06 | High | 3.3 root changelog | `CHANGELOG.md` records the public 3.3 feature/security/compatibility boundary |
| HX-07 | High | 3.3 examples and mount-order samples | `examples/*` use 3.3.0 where appropriate and Nest/Express demonstrate auth → admission → FlexDoc mount order |
| HX-08 | Medium | Host-impact threshold rebaseline process | Maintainer docs define when/how thresholds move, evidence required, and how to avoid normalizing regressions |
| HX-09 | Medium | JavaScript bundle headroom policy | Maintainers explicitly choose trim-first vs measured budget slack after 3.3 routing growth |
| HX-10 | Medium | Shared host-execution policy types | Core types can be reused by future Cloud gateway/SSRF policy instead of inventing a parallel allowlist model; precursor to legacy P0-18 |
| HX-11 | High | Ruby Rack auth/middleware boundary | Rack/Rails host execution has an explicit tested auth/admission ordering contract and fails closed when the boundary is absent |
| HX-12 | High | Go handler auth/admission boundary | Go host execution has a tested handler/middleware boundary showing authentication and admission before FlexDoc execute handling |
| HX-13 | High | Elixir Plug auth/middleware boundary | Plug/Phoenix host execution has an explicit tested pipeline boundary and cannot silently expose execute without application auth/admission |

## 3.5 API Client transport UX and execution policy

Backend execution should be visible and controllable enough that users understand where requests run without learning internal implementation details.

| ID | Priority | Work |
|---|---|---|
| UX-01 | High | Transport badge: Browser / API host / Host required, with optional browser→host and host→target timing split |
| UX-02 | High | Positive `capabilities: []` copy in advanced API Client, basic density and Try It: “runs from your API server” |
| UX-03 | High | Per-request “Prefer browser” / “Prefer API host” override mapped to `preferHostExecution` |
| UX-04 | High | Server-serialized `hostExecution.preferHostExecution`, designed as the later Cloud/tenant policy hook |
| UX-05 | Medium | Capability explainer showing live `capabilities` and which features are universal vs host-specific |
| UX-06 | High | Execute-route preflight for common CSRF/auth/middleware misconfiguration |
| UX-07 | Medium | CORS failure helper that suggests host execution when available and policy allows |
| UX-08 | High | Resolve `ApiClientRunnerPage` host-preference behavior against the documented headless-direct default; fix or document and regression-test |
| UX-09 | High | Credential scope UX: session-only, remember in browser, or never store (closes the S-09 / T-05 strategy gap) |
| UX-10 | Medium | Slow-host guidance suggesting browser-direct execution when CORS permits and host latency exceeds a defined threshold |

## 3.6 History, privacy and operator observability

Host execution creates new privacy and operational evidence that should be designed before Cloud introduces centralized audit.

| ID | Priority | Work |
|---|---|---|
| OBS-01 | High | History privacy mode: opt out of persisted response/request bodies for host-executed requests and redact sensitive headers in IndexedDB |
| OBS-02 | High | Stable `flexdoc.execute.*` event schema, tenant-ready and body-free by default |
| OBS-03 | High | `onHostExecutionStart` / `onHostExecutionComplete` backend hooks before any Cloud audit pipeline |
| OBS-04 | High | Prometheus-style operator metrics contract for execute QPS, in-flight, 429/rejections and latency |
| OBS-05 | Medium | Publish a release-facing Host Impact summary derived from the permanent benchmark |

## 3.7 Post-release observation

3.3 introduces a new operational traffic path, so the first post-release behavior review should focus on evidence rather than immediate expansion.

Track host-execution latency, request rejection reasons, CPU/request, cooldown memory trends, framework-specific transport errors, transport mix and user confusion around direct versus host execution. Do not overreact to one-run managed-runtime PSS deltas; use repeated matched runs and heap/native evidence before labeling retention as a FlexDoc leak.

The .NET investigation already demonstrated why this matters: one small-body allocation issue was real and fixable, while earlier frightening JVM subtraction was not reproducible as live-object retention.

## 3.8 3.4 definition work

The next major product-design task should be turning “Service Workbench” from a direction into a crisp backend-native contract. The first slice should connect surfaces FlexDoc already owns rather than starting with an isolated diagnostics dashboard.

The 3.4 definition should answer:

- how Runtime Intelligence can prefill server URL and open discovered/documented operations in API Client;
- how OpenAPI `servers` plus runtime `serverOrigin` can suggest, but never silently mutate, host-execution allowlists;
- how Contract Validation findings can offer “probe this operation” through host execution;
- how Contract Validation expands from Node to FastAPI, Spring and ASP.NET Core without pretending evidence is equal where discovery is partial;
- how Try It warns on `runtimeOnly` / undocumented routes before execution or allowlist failure;
- whether an opt-in executor identity/debug response marker is useful without leaking implementation details;
- how Go Runtime Intelligence should be packaged alongside existing Go host execution;
- what service/runtime state is safe to expose by default;
- what information can be derived without instrumenting every application request;
- what request/trace correlation is opt-in;
- which features are observational versus mutating;
- how redaction and authorization work;
- how each framework reports capability completeness;
- what overhead budgets apply to always-on or sampled diagnostics;
- how progressive native execution capabilities are sliced per runtime, beginning with cookie jar and then mTLS/client certificates rather than pretending parity exists everywhere at once;
- how `flexdoc run --prefer-host` selects host transport explicitly and records `transport: host|direct` in machine-readable reports.

# 4. Product feature strategy

## 4.1 Layer 1 — maintain the excellent API reference/client baseline

These are no longer the differentiating roadmap, but they remain the product foundation.

Continue maintaining OpenAPI compatibility, rendering quality, API Client usability, auth behavior, imports, scripts/tests, history, runner semantics, accessibility, search and code samples. Add parity features when they are required for real adoption or unblock backend-native workflows.

The remaining Layer 1 gaps should be named rather than left as ambient maintenance:

- **SEARCH-01 — Full-text API search index:** operations, parameters, schemas and descriptions, with an index design that can later become permission-aware in Cloud.
- **PLAY-01 — Public spec playground:** paste/upload a spec and get a disposable reference/client experience suitable for activation and compatibility debugging.
- **OAS-01 — OpenAPI webhooks:** first-class navigation and reference surface.
- **OAS-02 — OpenAPI callbacks:** first-class interactive/reference surface.
- **OAS-03 — OpenAPI Links:** first-class compatibility and interaction behavior with explicit matrix ownership.
- **UX-11 — Multipart binary file picker:** first-class file selection for multipart bodies rather than only structural/binary body support.
- **ENV-01 — Named saved environments:** explicit product UX for durable named environments beyond basic workspace state.
- **URL-01 — Slug + version redirect model:** stable full-site URLs and redirects beyond hash-only deep linking.

Avoid large “REST client clone” epics unless customer evidence shows a concrete blocker. FlexDoc already has enough client functionality to support its strategic direction.

## 4.2 Layer 2 — backend-native intelligence

This is the primary moat.

High-priority capability families include:

### Runtime truth

Show what routes, handlers and framework/runtime context actually exist in the running service. Continue expanding truthful discovery where framework APIs make it reliable.

### Contract intelligence

Compare the declared contract with implementation evidence. Expand carefully from route/method drift toward request/response schema evidence and breaking-change policy only when the data source is trustworthy.

### Backend-context execution

Use the API host’s network position to execute approved requests that browsers cannot. Keep exact allowlists, fail-closed capabilities and deployment auth/admission controls mandatory.

### Service diagnostics

Expose framework-aware information that helps a developer understand “why is this endpoint behaving this way?” without turning FlexDoc into an APM agent.

### Request/trace context

Where opt-in integrations exist, connect an API operation or execution result to trace IDs, logs or diagnostic events. Prefer linking to existing observability systems over reimplementing them.

## 4.3 Layer 3 — Service Workbench

3.4 should unify the above into one operation-centric workbench.

A developer viewing an operation should eventually be able to answer:

- Is this operation actually registered in the running service?
- Which framework handler owns it?
- Does runtime behavior match the documented method/path/schema expectations?
- Which environment/service instance am I looking at?
- Can I execute this request from the service network safely?
- What happened during the last execution?
- Is there a trace/log/diagnostic reference I can follow?
- Are there known drift findings or operational warnings?

The key is **one workflow around the service**, not a dashboard of unrelated diagnostics.

## 4.4 Layer 4 — fleet/cloud collaboration

Once the single-service workbench provides repeatable value, FlexDoc Cloud can aggregate and govern it.

Cloud should eventually add:

- organizations, projects and service inventory;
- Git/source sync and hosted docs where useful;
- fleet-level runtime/contract health summaries;
- team review workflows and PR previews;
- centralized policy for validation and allowed execution targets;
- shared environments/secrets with proper security controls;
- audit logs, RBAC, SSO/SCIM and enterprise access;
- retention/history/analytics beyond the local browser;
- cross-service API catalog and ownership mapping;
- hosted build/deploy convenience;
- permission-aware AI over the structured product and runtime model.

The cloud product should make the backend-native engine more valuable across a fleet. It should not become a separate renderer or generic documentation CMS.

## 4.5 Features deliberately deprioritized

The following are valid but should not displace the backend-native sequence:

- general visual page builder;
- broad marketing-site CMS;
- AI chatbot before strong service context and permissions;
- SDK generation purely to copy Fern/Scalar;
- every protocol at once;
- a generic outbound proxy;
- proprietary request model incompatible with the open-source client;
- cloud-only core features that make self-hosting second-class.

## 4.6 Protocol expansion

REST/OpenAPI remains the core. Protocol expansion should be demand-driven.

Potential later directions include AsyncAPI/event-driven references, GraphQL, gRPC/OpenRPC and richer webhook surfaces. These should enter the roadmap when there is a clear backend-native capability to add, not just because competitors list the format.

---

# 5. Security model and threat register

## 5.1 Security principles

FlexDoc’s security model has changed with the product. The highest-value new capability — backend execution — is also a privileged network feature.

Core principles:

1. **Backend execution is a privileged server-side network capability.** Treat it like a narrowly scoped developer tool, not a convenience proxy.
2. **The docs route and execute route must inherit real application authentication/authorization.** A protocol marker is not authentication.
3. **Exact allowlists and destination validation constrain where requests can go; admission controls constrain how much a valid user can do.** Both are required.
4. **Capabilities must fail closed.** If an adapter cannot guarantee a host-only behavior, it must not advertise it.
5. **No secret should be logged by default.** This includes auth headers, cookie jars, client certificates, response bodies and environment values.
6. **Local browser persistence is still sensitive storage.** History can contain response bodies, tokens and PII; keep it bounded and user-clearable.
7. **Runtime Intelligence should expose only safe service context by default.** Do not leak hostnames, local addresses, process environment or framework internals without a deliberate contract.
8. **Performance safety is part of security/reliability.** A diagnostics feature that adds unbounded work to application requests is not acceptable.
9. **Self-hosted packages should remain useful without required telemetry.** Security should not depend on a cloud call-home path.

## 5.2 3.3 host-execution controls

The shipped 3.3 native transports use a combination of:

- exact-origin allowlists;
- metadata/link-local blocking;
- validated-address connection pinning where supported;
- redirect revalidation;
- preservation of original Host/SNI/TLS authority;
- rejection of unsafe transport headers;
- bounded request and response sizes;
- execution deadlines;
- system proxy bypass on pinned native transports so proxy configuration cannot silently bypass destination validation;
- framework-specific fail-closed routing/middleware requirements;
- security contract tests across multiple adapters.

The `X-FlexDoc-Execute: 1` marker is protocol/cross-site friction only. It is **not authentication and not a CSRF token**.

If application authentication is cookie-based, normal CSRF controls still apply. Production deployments should add caller-aware rate/admission limits, bounded concurrency, body/time limits and monitoring for execute QPS, in-flight work, 429/rejections and target latency.

For 3.3.x, these requirements should become productized contracts rather than documentation alone: ship an admission-control helper in `@prauga/flexdoc-backend`; enforce Laravel `register()` fail-closed parity; establish an equivalent tested fail-closed rule for Symfony and other stacks; and expose lifecycle hooks/metrics without logging bodies or secrets by default.

## 5.3 Updated threat register — embedded/self-hosted product

| ID | Severity | Threat | Current/required control |
|---|---|---|---|
| E-01 | Critical | Host execution used for SSRF/internal scanning | Exact origin allowlists, metadata/link-local blocks, DNS/address validation, redirect checks, proxy bypass, egress policy |
| E-02 | High | Authenticated user causes excessive outbound load | Caller-aware rate limits, shared admission-control helper, concurrency caps, deadlines, QPS/latency monitoring |
| E-03 | High | Docs/execute route exposed without application auth | Mount under same authenticated boundary as privileged developer surfaces; fail closed where framework middleware/firewall is required |
| E-04 | High | Cookie-based auth assumes custom marker provides CSRF safety | Apply the application’s normal CSRF model; test/document per framework |
| E-05 | High | Secrets leak through logs/history/errors | Redaction, avoid auth/body logging, history privacy mode, sensitive-header filtering, explicit saved-secret model only later |
| E-06 | High | Runtime Intelligence leaks sensitive host/process data | Safe additive contract, omit untrusted/nonstandard environment details, permission-gate future deeper diagnostics |
| E-07 | Medium/High | Large request/response causes memory or event-loop pressure | Size limits, off-event-loop blocking work, streaming/bounded receipt where appropriate, deadlines, cross-runtime impact gates |
| E-08 | Medium | Redirect or DNS rebinding bypasses validation | Revalidate destination, pin validated address sets where possible |
| E-09 | Medium | Framework adapter advertises behavior it cannot enforce | Explicit capability contracts and fail-closed defaults |
| E-10 | Medium | Local browser history stores sensitive responses or credentials | Bounded IndexedDB, body caps, credential-scope UX, opt-out body persistence, delete/clear controls |
| E-11 | Medium | Supply-chain/package compromise | Locked dependencies, audit checks, parity workflows, GitHub releases, provenance improvements, minimal runtime external assets |
| E-12 | Medium | Diagnostics add application hot-path overhead/DoS surface | Path-scoped registration, sampling, bounded work, benchmark regression gates |
| E-13 | Medium | Users cannot tell whether a request leaves the browser or runs from the API host | Explicit transport badge, host-required state and policy/preference visibility |
| E-14 | Medium | Cloud later invents a second SSRF/allowlist policy model | Share host-execution policy types/manifests where practical and keep signed Cloud policy additive to local exact-origin enforcement |

## 5.4 Future Service Workbench security requirements

Any 3.4 diagnostics feature should declare:

- whether it reads static config, runtime registry data or per-request traffic;
- whether it executes code or network calls;
- whether it can expose secrets, request bodies, headers, user identity or internal topology;
- the default retention period;
- the authorization boundary;
- redaction rules;
- size/time/concurrency limits;
- how to disable the capability entirely;
- the overhead budget and regression test.

A strong default is **observational, bounded and ephemeral**. Persisted traffic capture should not be a hidden default.

## 5.5 Future cloud threat register

The August SaaS threat model remains valid if/when FlexDoc Cloud is built. Key risks remain cross-tenant access, malicious repository/build execution, SSRF in remote fetches, custom-domain misbinding, Git integration compromise, private-doc authorization bypass, noisy neighbors, sensitive analytics/history, webhook spoofing, supply-chain compromise, incomplete deletion/restore and account takeover.

The architecture response remains: tenant context everywhere, database RLS as a backstop, tenant-prefixed storage/index/cache keys, isolated ephemeral build workers, verified custom domains, restricted network fetchers, mature identity providers, immutable audit events, encrypted secrets, quotas and tested restore/deletion workflows.

## 5.6 Explicit security-policy carry-forwards

The September roadmap must retain four policy decisions from the August audit as named work rather than implicit guidance:

- **SEC-01 — Active-content policy:** define how `customCss` and especially `customJs` behave on self-hosted, shared-origin and isolated-origin deployments; shared multi-tenant origins must not silently gain arbitrary active content.
- **SEC-02 — Visitor JWT policy:** either define a complete JWT validation contract or explicitly replace the concept with OIDC/JWKS-backed validation; do not ship a home-grown ambiguous token verifier.
- **SEC-03 — Hostile-input quotas:** before untrusted SaaS ingestion, enforce spec byte, node, nesting/depth and processing-time ceilings with deterministic failure behavior.
- **SEC-04 — Packaged-page CSP guidance:** document and test a practical Content Security Policy for adapter/host pages, including script/style/worker/connect implications of the renderer, API Client and any extension surface.

HTTP-boundary conformance remains part of the PR-hardening ledger: PHP and Elixir must receive the same explicit negative-path coverage as the already named Spring/Go/Plug/Rack cases.

---

# 6. Current and target architecture

## 6.1 Current embedded architecture

The current product should be understood as five cooperating layers.

### Canonical renderer

One standalone renderer produces the API reference, API Client and backend-native panels. Native packages reuse synchronized assets rather than own UI forks.

### Canonical request/workspace model

Collections, folders, requests, environments, auth, scripts, tests, history, Postman import, interactive execution and Runner execution share the same model.

### Backend adapter layer

Framework adapters mount documentation and advertise supported runtime/validation/execution capabilities.

### Backend-native contracts

Runtime Intelligence, Contract Validation and host execution are additive protocols under the docs path. They expose only what the host can truthfully support.

### CLI/headless layer

Validation and Runner workflows consume the same backend evidence/request model in CI and automation.

This is the architecture to preserve through 3.4.

## 6.2 3.4 Service Workbench target architecture

Service Workbench should add a **diagnostic provider contract** rather than framework-specific renderer code.

Recommended conceptual model:

- `service`: safe identity of the running application/environment;
- `runtime`: framework/language/runtime metadata and discovery completeness;
- `operations`: runtime handler evidence mapped to canonical OpenAPI operations;
- `validation`: current contract findings;
- `execution`: advertised host transport and advanced capabilities;
- `diagnostics`: bounded framework/service observations;
- `links`: trace/log/APM references or external diagnostic targets;
- `health`: optional developer-facing checks that are clearly separated from production monitoring.

Each provider should report capability completeness and freshness. The renderer should not infer that missing data means “healthy.”

## 6.3 Avoid becoming an APM agent

FlexDoc should integrate with observability rather than compete with Datadog, Grafana, New Relic or OpenTelemetry collectors.

Good 3.4 behavior:

- expose trace IDs from an execution;
- link an operation to configured observability queries;
- show handler/framework metadata;
- show local route/contract drift;
- show a bounded recent diagnostic result when the adapter can provide it cheaply.

Bad 3.4 behavior:

- always-on full request/response capture by default;
- high-cardinality metrics pipeline inside FlexDoc;
- building a log store;
- duplicating distributed tracing infrastructure;
- adding global middleware to every application request merely to populate the docs UI.

## 6.4 Future cloud architecture

When the cloud phase begins, retain the August recommendation: **modular control plane plus isolated workers**, not premature microservices.

The first cloud trust boundaries should be:

- control-plane application and database;
- build workers;
- remote-fetch/egress worker;
- docs delivery/edge;
- search/indexing;
- optional explorer/host-execution gateway for cloud-hosted use cases;
- analytics/metering;
- audit event stream.

The database model should keep tenant identity explicit on every tenant-owned resource and use RLS as defense in depth. Build workers should be ephemeral and receive short-lived credentials. Object storage, search indexes, caches and queues must all be tenant-keyed.

## 6.5 Future fleet architecture opportunity

A cloud control plane becomes much more differentiated if it can ingest **signed/authorized summaries from installed FlexDoc adapters** rather than merely host static docs.

Possible future fleet objects:

- service registration;
- deployed version/runtime identity;
- runtime route inventory summary;
- contract validation status;
- known drift findings;
- approved execution origins/policies;
- environment metadata;
- health/diagnostic capability declarations;
- service ownership/team mapping.

This creates a path to an internal API/service catalog that is grounded in running services rather than only repository metadata.

---

# 7. Platform engineering, performance and operations

## 7.1 CI/CD as a product feature

The project now has a much stronger release discipline. The 3.3 release demonstrated the desired pattern: feature work, framework-specific tests, canonical UI tests, security regressions, performance measurements and parity checks converged on one exact release state before publication.

Permanent CI surfaces should include:

- canonical JavaScript build/test/lint;
- Browser E2E;
- OpenAPI compatibility fixtures;
- framework/language adapter suites;
- framework coverage contract checks;
- canonical renderer asset parity;
- deterministic bundle budgets;
- host impact baseline;
- docs contract checks;
- Rust Axum/Actix executor parity only while implementations remain duplicated;
- package/version/example guards;
- dependency/security audit checks;
- malicious-spec/CSP browser gate;
- OAuth/PKCE browser E2E;
- accessibility (`axe`) and visual-regression coverage;
- a Docs CI workflow/GitHub Action combining `flexdoc validate` with optional staged host-execution smoke.

## 7.2 Performance contract

The operator promise should remain:

> Installing FlexDoc must not impose hidden work on ordinary application traffic, and docs/runtime features must have measured bounded cost.

For Node hosts, docs page generation is cached per configured integration and served with `no-cache` plus deterministic ETags. Versioned renderer assets are cacheable as immutable content. Independent replicas can generate the same content validator without shared cache state.

Host execution does add real load when used. This is acceptable because it is explicit, user-driven and measurable. It should not be confused with zero-overhead documentation serving.

## 7.3 Host Impact Baseline

The ten-runtime baseline is strategically valuable beyond 3.3. Keep it as a permanent guard whenever execution, diagnostics or runtime integrations change.

Track:

- matched direct-versus-host latency;
- throughput;
- CPU/request;
- active RSS/PSS trend;
- cooldown working set;
- error/rejection rates;
- runtime-specific anomalies.

Avoid brittle absolute shared-runner timing SLAs. Use coarse regressions plus trend review and deterministic structural guarantees.

Maintainers also need a written **threshold rebaseline process**. A threshold should move only when a reviewed change explains the new cost, repeated measurements establish a stable new baseline, security/performance owners accept the trade-off, and the change log records why the budget moved. Rebaselining must not be the default response to a regression.

For the JavaScript bundle, adopt an explicit **headroom policy** after 3.3 routing growth: trim before increasing budgets; if budget slack is intentionally increased, document the feature cost and keep compressed-size ceilings evidence-based rather than mechanically following raw size.

## 7.4 3.4 observability for FlexDoc itself

Before adding richer diagnostics for user services, FlexDoc should be able to observe its own impact.

Define a stable, body-free-by-default `flexdoc.execute.*` event vocabulary and optional backend hooks such as `onHostExecutionStart` / `onHostExecutionComplete`. A Prometheus-style metrics contract should cover, at minimum:

- docs page requests and revalidation hit rate;
- runtime endpoint latency/errors;
- validation generation latency/findings count;
- host execute QPS and transport mix;
- in-flight work and admission-control 429/rejections;
- target/total execution latency;
- queue/concurrency saturation where adapters use bounded executors;
- response-size truncation/limit events;
- diagnostic provider latency/error rate.

Publish a concise Host Impact summary with release-facing performance documentation so operators can see the measured contract without reading CI internals.

Self-hosted telemetry export must remain local/application-controlled. Do not send this to Prauga by default, and do not include request/response bodies in the default event schema.

## 7.5 Release and rollback discipline

A coordinated product release should be reproducible from a reviewed commit/tag. Package examples must point to artifacts that actually exist. Generated renderer assets must match the canonical build. Native adapters should publish under their own ecosystem versions and should never silently replace an already-published immutable version with different source.

For 3.3, `docs/releases/3.3.md` is the detailed release contract, while root `CHANGELOG.md` must expose the milestone at repository level. `docs/api-client-roadmap.md` remains the canonical milestone sequence and should be updated as shipped/in-flight status changes.

The release-facing artifact set should include the Host Impact summary and explicit documentation of any performance-budget rebaseline. Example applications should demonstrate the recommended security order — application auth, admission/rate control, then FlexDoc mount/execute handling — so secure deployment is copyable rather than merely described.

When a future cloud control plane exists, application releases and docs-site releases should remain independently rollbackable.

The release/trust program also has explicit pre-Cloud milestones: **REL-01** tag-driven releases with npm provenance/trusted publishing; **REL-02** tarball-install smoke tests across framework examples; **REL-03** a formal 1.x → 3.x migration guide; **REL-04** an adapter-authoring guide and versioned renderer/adapter contract; **REL-05** a `flexdoc dev` local-preview command; **REL-06** asset-sync parity as a required CI/completion gate; and **REL-07** a public renderer-configuration freeze/versioning policy. Governance must add **GOV-01** `SECURITY.md` with private vulnerability reporting/SLA and **GOV-02** `CONTRIBUTING.md` plus an explicit maintainer/release cadence.

# 8. Packaging, licensing and commercial model

## 8.1 Open source remains the distribution engine

The open-source/self-hosted product should remain genuinely useful. The current product story is no longer an early “OSS 2.0” aspiration: the shipped line from **2.8 through 3.2** already includes the standalone workspace, Postman import, shared runners, Runtime Intelligence, Contract Validation, production-readiness gates and headless CI execution, while **3.3** is the native backend-execution release boundary.

The OSS surface should continue to include:

- API reference renderer;
- API Client and Try It;
- Postman import/workspace migration into canonical FlexDoc state;
- collections/environments/scripts/history;
- Runtime Intelligence baseline;
- Contract Validation baseline and `flexdoc validate`;
- `flexdoc-runner` / headless request-folder-collection execution and CI reports;
- native backend execution with explicit policy/security controls;
- framework adapters;
- static/detached deployment and future `flexdoc build` improvements;
- local CLI and Docs CI workflows.

The launch gate for 3.3 must therefore be an explicit **OSS 3.3 gate**, not a stale “OSS 2.0” gate: published native execute support, working interactive `preferHostExecution`, secure operations guidance, consistent artifacts/examples and green host-impact/security smoke.

Product milestone status should be reconciled against `docs/api-client-roadmap.md`; 3.3 behavior/security should be reconciled against `docs/releases/3.3.md`.

Do not cripple the moat to force cloud conversion. The better conversion path is to make teams want shared/fleet workflow after the single-service product proves valuable.

## 8.2 What a future cloud product should monetize

The highest-value paid surfaces are likely to be:

- team/fleet visibility across many services;
- centralized contract health and drift history;
- shared policy and CI governance;
- hosted documentation and custom domains for teams that want it;
- Git/PR review workflows and previews;
- shared environments/secrets with proper vault/audit controls;
- access control, SSO, SCIM, RBAC and audit logs;
- longer retention and analytics;
- service catalog/ownership/dependency views;
- enterprise isolation and self-hosted/hybrid control plane;
- support, SLA and security/compliance packages;
- permission-aware AI over customer-authorized docs/runtime evidence.

## 8.3 What not to monetize

Do not put security fixes behind paid plans. Do not make the renderer intentionally worse. Do not require cloud telemetry for self-hosted use. Do not prevent export. Do not make basic OpenAPI compatibility a premium feature. Do not remove local Runtime Intelligence merely to create a cloud upsell.

## 8.4 Pricing strategy — revise before launch

The August document included illustrative prices. Those numbers should now be treated as deprecated hypotheses. The competitor market has moved and generous free tiers are common.

Before setting prices, interview design partners and validate willingness to pay for **fleet intelligence, governance and enterprise workflow**, not merely documentation hosting.

A more useful packaging model than premature dollar amounts is:

| Tier | Product intent |
|---|---|
| Open Source | Full single-service embedded workbench and local/CI tooling |
| Cloud Free / Hobby | One/few services, hosted portal convenience, limited fleet history |
| Team | Multiple services, reviews, shared policies/environments, analytics, drift history |
| Business | Advanced governance, access controls, audit, longer retention, larger fleet |
| Enterprise | SSO/SCIM/RBAC, isolation options, self-host/hybrid, compliance/SLA/support |

## 8.5 Licensing

The repository currently declares **AGPL-3.0-or-later**. Do not change that casually during product development.

Before significant commercial embedding partnerships, conduct a deliberate legal/business review of whether the desired model is:

- AGPL open source + commercial embedding license;
- dual licensing;
- permissive renderer/core with proprietary cloud;
- another clearly documented model.

The goal is not ideological purity; it is low ambiguity for adopters and a business model Prauga can enforce and support.

---

# 9. Roadmap

Sequence matters more than adding many features. This section should stay synchronized with `docs/api-client-roadmap.md`; release-specific 3.3 details belong in `docs/releases/3.3.md`. The strategy document owns prioritization and cross-cutting security/commercial sequencing, not a second competing milestone ledger.

## Phase 0 — Shipped backend-native foundation (2.8 → 3.2)

These are not historical footnotes; they are the product surfaces that 3.3 and 3.4 build on and must stay visible in milestone planning:

- **S0-01 — 2.8 Postman import + standalone API Client workspace:** shipped; imported collections/environments become canonical FlexDoc state rather than a parallel client.
- **S0-02 — 3.0 Runtime Intelligence:** shipped; live runtime/service evidence and explicit partial-discovery semantics across supported frameworks.
- **S0-03 — 3.1 Contract Validation:** shipped first slice; backend-produced Node operation drift evidence consumed by renderer and `flexdoc validate`.
- **S0-04 — 3.2 FlexDoc Runner / headless CI:** shipped; portable request/folder/collection execution using the canonical request/auth/script model and CI-oriented reports.
- **S0-05 — 3.3 Backend Execution Expansion:** **shipped 15 Sep 2026**; native API-host execution and transport routing extend the foundation rather than starting a separate product.

Canonical detail remains in `docs/api-client-roadmap.md`; 3.3 release behavior/security detail remains in `docs/releases/3.3.md`.

## Phase A — OSS 3.3 Backend Execution Expansion

**Status:** **shipped 15 Sep 2026**; current work is 3.3.x post-release hardening and UX completion.

**Outcome:** controlled native API-host execution across the supported runtime families, default interactive host routing when available, permanent security/operations guidance and cross-runtime impact regression coverage.

**OSS 3.3 exit gate:** complete for the published 15 September release. Subsequent security, UX and adapter-version work belongs to 3.3.x and must preserve the shipped contract unless a new release explicitly changes it.

### A1. 3.3.x host-execution hardening

Immediately after release, complete the explicit HX milestone set: `@prauga/flexdoc-backend` admission control; Laravel manual `register()` fail-closed parity; Symfony, Rack, Go and Elixir auth/middleware boundaries; shared Rust host-execution crate or formal ADR; remaining Python ASGI event-loop work; root 3.3 changelog; 3.3 examples with auth → admission → FlexDoc ordering; Host Impact rebaseline process; post-3.3 JavaScript bundle-headroom policy; and reusable core host-execution policy types for the future Cloud SSRF service.

### A2. Transport, privacy and operator UX

Complete UX-01 through UX-10 and OBS-01 through OBS-05 so host execution is visible, controllable, privacy-aware and observable before it becomes a dependency of Cloud or deeper diagnostics.

### A3. PR/security-boundary hardening

Treat the following as an optional but named hardening bucket rather than ad-hoc review cleanup: HTTP-boundary security tests for Spring metadata paths, Go execute handlers and Plug/Rack integrations; JVM/PHP security-conformance test naming parity; and a Spring Filter bean/starter path that makes admission ordering straightforward and testable.

## Phase B — 3.4 Service Workbench

**Goal:** make FlexDoc useful for understanding and debugging a running service, not just documenting and sending requests to it.

Recommended 3.4 scope:

### B1. Operation-centric workbench shell

Create a unified operation view combining contract, runtime registration, validation status, execution and diagnostics. Avoid separate disconnected dashboards.

### B2. Runtime Intelligence → API Client

Use runtime `serverOrigin` and discovered route evidence to prefill target context and provide “open in API Client” from the Runtime Intelligence surface.

### B3. Runtime → allowlist assistant

Suggest `allowedOrigins` candidates from OpenAPI `servers` plus trustworthy runtime origin. Require explicit administrator confirmation; never auto-expand egress policy from an untrusted spec.

### B4. Contract Validation → host execute

Add “probe this operation” from validation findings, initially where evidence is trustworthy. Warn when an operation is `runtimeOnly` / undocumented before a request runs into confusing allowlist or contract failures.

### B5. Cross-framework Contract Validation expansion

Extend backend-produced validation from the current Node baseline to FastAPI, Spring and ASP.NET Core with explicit completeness semantics.

### B6. Framework-aware handler context

Where safe and supported, expose handler/controller/module identity, route source and discovery completeness. Do not use brittle reflection to fabricate details.

### B7. Execution diagnostics

For requests sent through FlexDoc, show timing phases and safe transport metadata available from the host executor. An executor-identity debug header/field may exist only as an explicit off-by-default diagnostic.

### B8. Trace/log linking

Provide opt-in hooks to attach trace IDs or links into configured observability systems. Prefer linking/integration over building a telemetry store.

### B9. Safe service/runtime context

Expose environment/service/version/build identity through explicit configuration or trustworthy runtime standards. Keep this read-only; do not create a server-secret injection API. Profiles/`NODE_ENV`-class identity should be safe metadata, not credential material.

### B10. Go Runtime Intelligence

Pair Go host execution with deliberate router-specific Runtime Intelligence discovery packages where package topology is clean and truthful.

### B11. Diagnostic provider contract

Define one additive provider protocol shared by adapters, including support/completeness flags, redaction, freshness and authorization.

### B12. Performance/security gate

Extend host-impact benchmarks to cover new always-on diagnostic work. No global hot-path middleware unless explicitly opt-in, sampled and measured.

### B13. Progressive native execution capability slices

Add host-only features incrementally by runtime, starting with a cookie jar and then client certificates/mTLS where the native stack can enforce policy safely. Capability advertisement must remain truthful when runtimes differ.

### B14. Headless host-transport selection

Add `flexdoc run --prefer-host` and report `transport: host|direct` in machine-readable run output so CI can opt into the same backend-network path without changing the canonical request model.

**3.4 exit gate:** a developer can open an operation and, on supported frameworks, see documented contract, runtime implementation evidence, validation state, safe service context, execute with transparent transport, and follow at least one diagnostic/trace context without introducing material unbounded request-path overhead.

## Phase C — Pre-Cloud quality and Contract Intelligence v2

Exact version numbers should remain uncommitted until 3.4 scope stabilizes.

Required pre-Cloud epics include:

- **SH-01 — Spec Health:** a real scored epic with CI consumption, not a strategy bullet;
- **QA-01 — Docs CI GitHub Action:** combine `flexdoc validate` with optional staged host-execution smoke;
- **SEARCH-01 — Full-text API search:** index operations, parameters, schemas and descriptions, with a path to permission-aware indexing later;
- **OAS-01 / OAS-02 / OAS-03 — webhooks, callbacks and Links:** promote the three currently partial surfaces to first-class owned compatibility/product work;
- **UX-11 / ENV-01 / URL-01 / PLAY-01:** close the highest-value Layer 1 adoption gaps without turning the roadmap back into generic client parity;
- **QA-03 — malicious-spec + CSP browser gate;**
- **QA-04 — OAuth/PKCE browser E2E completion;**
- **QA-05 / QA-06 — `axe` accessibility and visual-regression coverage;**
- **BUILD-01 — `flexdoc build` / static-site output maturation;**
- **REL-01 through REL-07 — release engineering and public contract discipline:** tag/provenance, tarball smoke, migration/adapter guides, `flexdoc dev`, required asset parity and renderer-config versioning;
- **GOV-01 / GOV-02 — security and contributor governance:** vulnerability reporting/SLA plus maintainer/release cadence;
- **SEC-01 through SEC-04 — active-content, visitor-auth, hostile-input quota and CSP policy;**
- request/response schema validation for explicit FlexDoc executions;
- richer breaking-change/drift policy in CI;
- deployment-to-deployment drift history;
- optional privacy-safe sampled live-traffic validation only after overhead/privacy controls are proven;
- hardening/follow-on coverage for the 3.4 native capability slices and host-selected runner transport after their first implementation.

**Exit gate:** FlexDoc can produce actionable contract/spec evidence beyond method/path presence, can run that evidence in CI, and retains trustworthy browser/security quality gates without pretending incomplete runtime data is authoritative.

## Phase D — Docs/export extensibility + Fleet / Cloud Alpha

Before or alongside the first hosted control plane, productize the portable documentation surface where it improves adoption without weakening the backend-native focus:

- **EXT-01 — Extension SDK:** typed `x-flexdoc-*` extension points plus safe, versioned plugin hooks.
- **EXP-01 — Portable site bundle export:** a deployable/exportable docs bundle usable by self-hosted and future Cloud workflows.
- **DOC-01 — Markdown/MDX guides:** guides alongside API reference without turning FlexDoc into a general CMS.
- **DOC-02 — SEO package:** sitemap, canonical URLs and OpenGraph metadata for hosted/public docs.
- **DOC-03 — Per-page feedback:** helpful/not-helpful feedback with privacy-safe aggregation.
- **DOC-04 — Status/service-health banner integration:** display configured operational status without making FlexDoc the status backend.

Begin the Cloud Alpha control-plane work only after single-service backend-native value is clearly demonstrated.

Candidate scope:

- organizations, projects/services and memberships;
- service registration and environment inventory;
- Git integration and hosted docs builds;
- fleet-level Runtime Intelligence / Contract Validation summaries;
- immutable deployment history;
- custom domains/TLS where hosted docs are offered;
- shared policy and CI results;
- basic analytics and feedback;
- metering/entitlements even if alpha is free;
- tenant-scoped data model with RLS and isolation tests;
- sandboxed build workers;
- audit events from day one;
- signed deployment manifest describing allowed execute origins/policy;
- hybrid VPC execution that reuses the customer-native `__flexdoc/execute` path while Cloud carries metadata/domains rather than becoming a generic proxy;
- explorer analytics for execute rate, transport mix and no-result search without capturing bodies by default;
- permission-aware search indexing with tenant/access filters from the first shared index design.

**Exit gate:** every tenant-owned store is isolation-tested; runtime/service ingestion is authenticated and scoped; signed execution policy cannot broaden local host allowlists silently; builds are sandboxed; secrets are encrypted; backups/rollback are exercised; quotas exist.

## Phase E — Team / Paid platform

Candidate scope:

- PR preview/review workflow;
- versions/products and guides;
- multi-service catalog and ownership;
- drift history and governance dashboards;
- shared environments and policy;
- private docs/access controls;
- richer analytics;
- public deployment/automation API;
- first paid plans and enforced entitlements.

## Phase F — Enterprise readiness

Candidate scope:

- SSO/SAML/OIDC via mature provider;
- SCIM;
- granular RBAC;
- audit log/export;
- retention policies;
- enterprise self-host/hybrid options;
- bridge/silo isolation;
- SLA/support/DR evidence;
- security/compliance package;
- regional/data-residency options when justified.

## Phase G — Expansion based on traction

Possible later directions:

- **AUTH-01 — advanced native auth slices:** Digest, Hawk, OAuth 1.0 and SigV4 where host-native execution can implement them safely and capability reporting stays truthful;
- AsyncAPI and event-driven service workbench surfaces;
- GraphQL/gRPC/OpenRPC where runtime integration creates unique value;
- agent/MCP execution with explicit consent, scoped credentials and audit;
- permission-aware AI search/assistant;
- **GTM-01** `llms.txt` generation once the docs/export pipeline is stable;
- **GTM-02 / GTM-03** public dogfooding and framework example-repository expansion as distribution assets;
- API catalog/governance/scorecards;
- SDK generation only if it supports a differentiated workflow;
- dependency/service maps derived from trustworthy runtime/config evidence.

# 10. Prioritized backlog and launch gates

The backlog below turns strategy into named milestone work. IDs are intended to remain stable enough for issues/epics even if release numbers move.

## 10.1 OSS 3.3 release completion

| ID | Priority | Item | Done when |
|---|---|---|---|
| R33-01 | P0 | Approve/merge 3.3 release PR | **Complete** — 3.3 published 15 Sep 2026 |
| R33-02 | P0 | Publish coordinated 3.3 JavaScript artifacts | **Complete** — `js/v3.3.0` published 15 Sep 2026 |
| R33-03 | P0 | Native adapter release/version hygiene | **Complete for 3.3 launch matrix**; later 3.3.x adapter releases tracked separately |
| R33-04 | P0 | OSS 3.3 host execution gate | **Complete** for published 3.3 contract |
| R33-05 | P0 | Post-publish smoke matrix | **Complete for launch**; ongoing regression checks remain permanent CI |
| R33-06 | P0 | Examples and release docs | **Complete for 3.3 launch**; repin future 0.6.0/0.9.0 examples only after those artifacts publish |
| R33-07 | P1 | First-release observation | No unexplained cross-runtime performance/security regressions; transport/rejection signals reviewed |

## 10.2 3.3.x host-execution hardening

| ID | Priority | Epic |
|---|---|---|
| HX-01 | High | Backend admission-control helper with in-flight cap and deterministic 429 |
| HX-02 | High | Laravel `LaravelFlexDoc::register()` fail-closed middleware parity |
| HX-03 | High | Symfony/non-Laravel firewall/middleware fail-closed contract |
| HX-04 | Medium | Shared Rust host-execution crate or explicit long-term ADR |
| HX-05 | High | Python ASGI invalid-marker and large-body blocking work fully off event loop |
| HX-06 | High | Root 3.3 changelog entry |
| HX-07 | High | 3.3 examples plus Nest/Express auth → admission → FlexDoc mount order |
| HX-08 | Medium | Host Impact threshold rebaseline maintainer process |
| HX-09 | Medium | JavaScript bundle headroom policy after 3.3 routing |
| HX-10 | Medium | Shared host-execution policy types for future Cloud gateway reuse (legacy P0-18 precursor) |
| HX-11 | High | Ruby Rack auth/middleware fail-closed boundary |
| HX-12 | High | Go handler auth/admission fail-closed boundary |
| HX-13 | High | Elixir Plug auth/middleware fail-closed boundary |

## 10.3 API Client transport, privacy and observability

| ID | Priority | Epic |
|---|---|---|
| UX-01 | High | Browser / API host / host-required transport badge + optional split timings |
| UX-02 | High | Positive host-available copy when `capabilities: []`, including Try It/basic density |
| UX-03 | High | Per-request browser/host preference override |
| UX-04 | High | Server-serialized `hostExecution.preferHostExecution` policy hook |
| UX-05 | Medium | Live host-capability explainer panel |
| UX-06 | High | Execute route preflight for CSRF/auth/middleware integration failures |
| UX-07 | Medium | CORS failure helper suggesting host transport when available |
| UX-08 | High | Align `ApiClientRunnerPage` host preference with documented headless-direct semantics |
| UX-09 | High | Credential scope UX: session-only / remember-in-browser / never-store (S-09 / T-05) |
| UX-10 | Medium | Slow-host fallback guidance when browser-direct is viable |
| OBS-01 | High | History privacy mode and sensitive-header redaction in IndexedDB |
| OBS-02 | High | Body-free-by-default `flexdoc.execute.*` event schema |
| OBS-03 | High | `onHostExecutionStart/Complete` OSS backend hooks |
| OBS-04 | High | Prometheus-style execute QPS/in-flight/429/latency contract |
| OBS-05 | Medium | Release-facing Host Impact summary |

## 10.4 3.4 Service Workbench backlog

| ID | Priority | Epic |
|---|---|---|
| SW-01 | Critical | Diagnostic provider contract and capability/completeness model |
| SW-02 | Critical | Unified operation workbench information architecture |
| SW-03 | High | Runtime Intelligence → API Client prefill/open flow |
| SW-04 | High | Runtime/OpenAPI allowlist suggestion assistant with explicit admin confirmation |
| SW-05 | High | Contract Validation finding → “probe this operation” host-execute CTA |
| SW-06 | High | Expand Contract Validation to FastAPI, Spring and ASP.NET Core |
| SW-07 | High | Drift-aware warning on `runtimeOnly` / undocumented routes |
| SW-08 | High | Framework-aware handler/controller metadata for supported runtimes |
| SW-09 | High | Host-execution diagnostic timing/result metadata |
| SW-10 | High | Safe service/deployment/runtime identity contract |
| SW-11 | High | Trace/log link integration hooks |
| SW-12 | Medium | Optional off-by-default executor identity debug metadata |
| SW-13 | High | Go Runtime Intelligence discovery paired with Go host execution |
| SW-14 | High | Redaction and authorization model for diagnostic data |
| SW-15 | High | Performance/overhead benchmark extension for diagnostics |
| SW-16 | Medium | User-facing runtime capability/partial-support matrix |
| SW-17 | Medium | Exportable diagnostic snapshot for support/CI |
| SW-18 | Medium | Progressive native capability slices: cookie jar first, then client certificates/mTLS per runtime |
| SW-19 | Medium | `flexdoc run --prefer-host` with machine-readable `transport: host|direct` reporting |

### 10.4.1 Optional PR/security-boundary hardening

| ID | Priority | Epic |
|---|---|---|
| PRH-01 | Medium | HTTP-boundary security tests for Spring metadata paths, Go execute handler, and Plug/Rack integrations |
| PRH-02 | Low | JVM/PHP security-conformance naming parity so cross-runtime boundary suites are discoverable and comparable |
| PRH-03 | Medium | Spring Filter bean/starter support for explicit authentication/admission → FlexDoc ordering |
| PRH-04 | Medium | PHP execute-route HTTP-boundary security tests covering auth/admission, invalid marker, destination rejection and bounded-body behavior |
| PRH-05 | Medium | Elixir execute-route HTTP-boundary security tests with the same negative-path parity expected from other native adapters |

## 10.5 Contract, compatibility, Layer 1 and release-quality backlog

### 10.5.1 Contract intelligence and browser quality

| ID | Priority | Epic |
|---|---|---|
| CI-01 | High | Request schema validation for explicit FlexDoc executions |
| CI-02 | High | Response schema/status/header validation |
| CI-03 | High | CI breaking-change/drift policy model |
| CI-04 | Medium | Deployment-to-deployment drift history |
| CI-05 | Medium | Additional framework-native validation evidence |
| CI-06 | Medium | Go router-specific runtime discovery packaging |
| CI-07 | Later | Privacy-safe sampled live-traffic validation |
| SH-01 | High | Spec Health score/epic with CI integration |
| QA-01 | High | Docs CI GitHub Action: `flexdoc validate` + optional staged host-execution smoke |
| QA-02 | High | Public OpenAPI compatibility matrix ownership and lifecycle (legacy P0-19) |
| QA-03 | High | Malicious-spec + CSP browser security gate (legacy P0-01) |
| QA-04 | High | OAuth/PKCE browser E2E completion (legacy P0-12 / A-02) |
| QA-05 | Medium | `axe` accessibility gate (legacy P0-14) |
| QA-06 | Medium | Visual-regression suite (legacy P0-17) |
| BUILD-01 | Medium | `flexdoc build` / static-site export maturation (legacy P0-20) |

### 10.5.2 Layer 1 OSS/reference-client gaps

| ID | Priority | Epic |
|---|---|---|
| SEARCH-01 | High | Full-text API search index across operations, parameters, schemas and descriptions; architecture must permit future permission-aware Cloud filtering |
| PLAY-01 | Medium | Public paste/upload OpenAPI playground for activation, quick evaluation and compatibility debugging |
| OAS-01 | Medium | OpenAPI webhooks as a first-class navigation/reference surface |
| OAS-02 | Medium | OpenAPI callbacks as a first-class interactive/reference surface |
| OAS-03 | Medium | OpenAPI Links as a first-class compatibility/interaction surface and matrix row |
| UX-11 | Medium | First-class binary multipart file-picker UI |
| ENV-01 | Medium | Named saved environments product UX with clear persistence/scope behavior |
| URL-01 | Medium | Full-site slug + version redirect model beyond hash deep links |

### 10.5.3 Release engineering and project governance

| ID | Priority | Epic |
|---|---|---|
| REL-01 | High | Tag-driven releases with npm provenance/trusted publishing and immutable source→artifact traceability |
| REL-02 | High | Tarball-install smoke tests before publish across supported framework example paths |
| REL-03 | Medium | Formal 1.x → 3.x migration guide, separate from release notes |
| REL-04 | Medium | Adapter-authoring guide and versioned renderer/adapter contract for new thin adapters |
| REL-05 | Medium | `flexdoc dev` local-preview CLI complementing `flexdoc build` |
| REL-06 | High | `npm run sync:adapter-assets --check` or equivalent asset-parity command as a required CI/completion gate |
| REL-07 | Medium | Public renderer configuration freeze/versioning and compatibility policy (legacy A-08) |
| GOV-01 | High | `SECURITY.md`, private vulnerability reporting path and published response/SLA expectations |
| GOV-02 | Medium | `CONTRIBUTING.md`, maintainer responsibilities and documented release cadence |

### 10.5.4 Security and policy carry-forwards

| ID | Priority | Epic |
|---|---|---|
| SEC-01 | High | `customCss` / `customJs` active-content policy for self-hosted, shared-origin and isolated-origin deployments |
| SEC-02 | High | Visitor JWT validation contract or explicit OIDC/JWKS replacement decision |
| SEC-03 | High | Hostile-input quotas for untrusted spec ingestion: byte/node/depth/time ceilings with deterministic failures |
| SEC-04 | Medium | CSP guidance and browser gate for packaged adapter/host pages |

### 10.5.5 Docs product, export and extension surfaces

| ID | Priority | Epic |
|---|---|---|
| EXT-01 | Medium | Extension SDK with typed `x-flexdoc-*` conventions and safe/versioned plugin hooks |
| EXP-01 | Medium | Portable site-bundle export usable by self-hosted and future Cloud deployments |
| DOC-01 | Medium | Markdown/MDX guides beside API reference |
| DOC-02 | Later | SEO package: sitemap, canonical URLs and OpenGraph metadata |
| DOC-03 | Later | Per-page helpful/not-helpful feedback with privacy-safe aggregation |
| DOC-04 | Later | Configurable status/service-health banner integration |
| AUTH-01 | Later | Progressive native Digest/Hawk/OAuth1/SigV4 capability slices with truthful per-runtime advertisement |

### 10.5.6 Shipped product surfaces that must remain named

| ID | Shipped milestone | Product surface |
|---|---|---|
| SHIPPED-28 | 2.8 | Postman import + standalone API Client workspace |
| SHIPPED-30 | 3.0 | Runtime Intelligence |
| SHIPPED-31 | 3.1 | Contract Validation first slice on Node + `flexdoc validate` consumption |
| SHIPPED-32 | 3.2 | `flexdoc-runner` / portable headless CI execution |

These are active foundations for later milestones, not completed work to delete from strategy/product documentation.

## 10.6 Cloud Alpha backlog — deferred, not canceled

The previous cloud backlog remains directionally correct: tenant-scoped data access/RLS, cross-tenant tests, isolated build workers, GitHub App lifecycle, immutable artifacts/rollback, tenant-prefixed storage, custom-domain verification/TLS, restricted remote fetch, mature identity, audit events, analytics, metering, rate limits and backup/restore drills.

Add the following explicit precursors:

| ID | Priority | Epic |
|---|---|---|
| CLD-01 | High | Signed deployment manifest for allowed execute origins/policy (legacy T-04) |
| CLD-02 | High | Hybrid VPC execute using customer-native `__flexdoc/execute`; Cloud remains metadata/domain control plane rather than generic proxy |
| CLD-03 | Medium | Explorer analytics: execute rate, transport mix, no-result search, no bodies by default (extends legacy C-11) |
| CLD-04 | High | Permission-aware search index with tenant/access filters (depends on legacy P0-15) |

It should be reactivated when backend-native product-market evidence justifies the control-plane investment.

## 10.7 Launch gates

| Milestone | Non-negotiable exit criteria |
|---|---|
| **OSS 3.3** | Exact release head green; native execute available on the supported matrix; interactive `preferHostExecution` behavior tested; host-execution security/operations guide complete; Host Impact baseline green and publishable; artifacts/examples/changelog consistent; smoke checks pass |
| **3.3.x hardening** | Productized admission control; framework fail-closed gaps closed/documented; event-loop/security regressions covered; transport/privacy/metrics contracts usable; performance rebaseline process documented |
| **3.4 Service Workbench** | Workbench is operation-centric; runtime→client, validation→probe and safe diagnostic context work on supported frameworks; data is capability-scoped/redacted; no material unbounded normal-route overhead; host-impact regressions green |
| **Contract Intelligence / Quality** | Spec/schema/behavior findings are evidence-backed, reproducible and CI-consumable; browser security/accessibility quality gates exist; named Layer 1 gaps have owners; release provenance/asset parity/governance policies are enforceable; incomplete runtime data cannot produce false authoritative claims |
| **Cloud Alpha** | Tenant isolation tests, sandboxed builds, verified domains, encrypted secrets, signed/scoped execute policy, quotas, backups/rollback and audit events |
| **Paid Team** | Stable preview/policy/fleet workflow, accurate metering, private-access policy tested, support path defined |
| **Enterprise** | SSO/SCIM/RBAC, audit export, isolation tier, DR evidence, vulnerability program, security package and measured SLA |

# 11. Metrics, go-to-market and open-source growth

## 11.1 North-star activation

The previous activation metric — time to first successful request — is still useful, but FlexDoc now needs a backend-native activation metric too.

Recommended activation funnel:

1. install/mount FlexDoc in a supported backend;
2. render the API reference;
3. make the first successful request;
4. enable Runtime Intelligence;
5. see at least one truthful runtime/contract state;
6. optionally execute through the backend host for an internal/otherwise-browser-limited target.

Measure **time to first successful request** and **time to first backend-native insight** separately.

## 11.2 Product metrics

For self-hosted/open-source distribution, use aggregate ecosystem signals rather than mandatory telemetry:

- package downloads;
- GitHub clones/stars/issues are secondary signals, not the north star;
- framework quickstart completion from docs/playground where measurable;
- support/issue frequency by adapter;
- release adoption and upgrade lag;
- community demand for missing framework/runtime capabilities.

For future opt-in/cloud measurement:

- successful host execution rate and rejection reason;
- Runtime Intelligence activation;
- validation findings resolved over time;
- Runner/CI usage;
- operation/workbench engagement;
- time from finding → fix;
- services with healthy contract state;
- preview/review usage;
- fleet retention.

## 11.3 Open-source growth loop

The fastest acquisition path should be **framework-specific and outcome-specific**.

Examples:

- “Add FlexDoc to FastAPI and detect undocumented runtime routes.”
- “Mount FlexDoc in Spring and execute an internal API from the service network.”
- “Run the same FlexDoc collection in the browser and CI.”
- “Compare NestJS runtime routes to your OpenAPI contract.”

These are stronger than a generic “beautiful API docs” demo because they demonstrate the backend-native moat.

Keep public examples for major frameworks, a current capability matrix, migration guides and transparent “supported / partial / planned” labels. Use FlexDoc to document FlexDoc wherever practical.

Name the GTM/documentation loop explicitly:

| ID | Priority | Milestone |
|---|---|---|
| GTM-01 | Later | `llms.txt` generation once the public docs/export surface is mature enough to be useful and maintainable; it is not a reason to prioritize generic AI chat |
| GTM-02 | Medium | Build FlexDoc's public docs with FlexDoc and publish the live compatibility/capability matrix from the same source of truth where practical |
| GTM-03 | Medium | Maintain runnable, versioned example repositories per major framework/runtime in addition to monorepo examples, optimized for copyable onboarding and security ordering |

## 11.4 Design-partner motion

Before building the cloud control plane, recruit a small number of backend-heavy teams that have:

- internal/VPC APIs;
- OpenAPI drift problems;
- several services/frameworks;
- CI contract checks;
- developer onboarding friction;
- existing observability tooling.

The goal is to validate whether Service Workbench and fleet-level contract intelligence solve painful workflows. Do not ask only whether the UI looks good.

---

# 12. Competitive benchmark — September 2026

The market baseline has moved further since the August review. The important conclusion is not that FlexDoc must copy every feature; it is that generic API reference/client/hosted docs features are increasingly commoditized.

## 12.1 Current market snapshot

| Competitor | Current signal | Strategic implication for FlexDoc |
|---|---|---|
| Scalar | Open-source MIT API reference and API client, OpenAPI 3.0/3.1, SDK/MCP products, 35+ framework integrations, hosted docs, and ability to mount inside an application | Closest product benchmark. “Runs inside your backend” alone is not differentiation |
| ReadMe | Free Starter with custom domain, bidirectional sync, interactive API reference, usage metrics, AI/llms.txt/MCP; paid collaboration/private docs; enterprise roles/audit/SSO | Hosted docs workflow and developer analytics are mature table stakes |
| Fern | Generous free docs tier with guides/API refs/changelog/explorer, multiple protocol support, AI/MCP, versions/products; enterprise governance/self-hosting | Strong docs/SDK/agent platform; FlexDoc should not chase SDK breadth without a moat |
| Mintlify | Free full docs platform with custom domain, auth, MCP and API playground; Pro adds agents/automations/previews/admin APIs; Enterprise SSO/SCIM/RBAC | AI and polished docs workflow are already bundled broadly |
| Redocly | Realm combines docs, API formats, governance/catalog features, analytics, MCP and enterprise access controls | Strong governance/catalog benchmark for later fleet/enterprise phases |

## 12.2 Scalar is the critical comparison

Scalar explicitly supports mounting its API Reference in frameworks including Express, Fastify, Hono, NestJS, FastAPI, Rails, Laravel, ASP.NET Core, Spring Boot, Go, Rust and Elixir. It also provides an open-source API client and hosted docs.

Therefore FlexDoc must not describe its moat as “we are installed inside the backend.” The meaningful claim is:

> **FlexDoc uses backend installation as an active product capability, not merely a delivery mechanism.**

FlexDoc should be better when the user needs runtime implementation evidence, contract-vs-runtime validation, controlled execution from the service network, framework-aware service diagnostics or a future fleet view grounded in running services.

## 12.3 Competitive feature filter

| Proposed feature | Could a document-only/hosted competitor implement it without backend installation? | Priority implication |
|---|---|---|
| Better syntax highlighting/theme | Yes | Maintenance/parity |
| Markdown guides | Yes | Later/docs workflow |
| Generic AI chat | Yes | Later |
| SDK generation | Yes | Only if strategic demand |
| Runtime route inventory from the live framework | Not reliably | High |
| OpenAPI ↔ registered-handler drift | Not with equivalent runtime evidence | High |
| Execute from the service’s private network with host policy | Not without some backend/agent presence | High |
| Handler/controller/framework introspection | Not reliably | High |
| Link a FlexDoc execution to service trace/log context | Backend integration creates strong advantage | High for 3.4 |
| Fleet view of live service contract health | Requires installed agents/adapters or equivalent | High after single-service value |
| Generic custom domains/hosting | Yes | Cloud convenience, not moat |
| SSO/RBAC/audit | Yes | Enterprise table stakes |

## 12.4 Intentional differentiation

FlexDoc should intentionally stand for:

- **backend-native truth:** runtime evidence instead of only spec/repository state;
- **one canonical workbench:** docs, client, runner, runtime, validation and execution share a model;
- **network-context leverage:** controlled access from the service environment;
- **self-hostable by default:** no required account, telemetry or cloud dependency;
- **truthful capability reporting:** partial framework support is explicit rather than hidden;
- **measured installation cost:** performance/host impact is part of the contract;
- **portable architecture:** cloud/fleet features enhance rather than replace local workflows.

---

# 13. Decision log and final recommendation

## 13.1 Decisions now considered settled

- One canonical renderer; no return to adapter-specific UI forks.
- One canonical API Client/request model across interactive and headless use.
- Independent semver for native ecosystems.
- Backend-native capability contracts are additive and fail closed.
- Self-hosted use does not require Prauga cloud or telemetry.
- Runtime Intelligence and Contract Validation are strategic product pillars, not side features.
- Backend execution is privileged and must remain explicitly allowlisted, authenticated and measured.
- Generic API-client parity is no longer the main roadmap.
- The immediate major product direction after 3.3 is Service Workbench.
- Full SaaS remains a later layer, not the next reflexive step.

## 13.2 Decisions still open

- Exact 3.4 diagnostic provider schema and framework support matrix.
- Whether 3.4 includes trace-link integration in the first cut or a follow-on.
- Exact post-3.4 version numbering and how schema/traffic validation is phased.
- Go router-specific Runtime Intelligence packaging boundaries.
- Commercial licensing model beyond the current AGPL posture.
- When cloud/fleet product evidence is strong enough to justify control-plane investment.
- Which cloud features belong in free versus paid tiers.
- Whether later protocol expansion should prioritize AsyncAPI, GraphQL or gRPC based on customer pull.

## 13.3 Final recommendation

FlexDoc has crossed the line the August strategy was trying to reach: it is now a credible, shared, testable product engine rather than a renderer concept that needs refoundation.

The next mistake would be to interpret that success as permission to become a generic docs SaaS.

**Ship 3.3 cleanly, then spend the next major product cycle making the backend-native position unmistakably valuable through 3.4 Service Workbench.** The product should help developers understand the running service, prove where the contract and implementation differ, execute from the service network safely, and connect an API operation to the diagnostic context needed to fix it.

If that workflow becomes something teams depend on, FlexDoc Cloud has a much stronger purpose: aggregate, govern and collaborate around real service truth across a fleet. That is a more defensible company direction than competing head-on with Scalar, ReadMe, Fern, Mintlify or Redocly on page rendering, AI chat and hosted-docs checklists alone.

The enduring roadmap rule is simple:

> **Prefer capabilities whose value comes from FlexDoc being inside the backend. Build generic docs/client parity only when it enables that advantage or removes a real adoption blocker.**

---

# Appendix A — milestone and old-audit disposition

## A.1 Milestone summary

**Shipped:** 2.3.0, 2.8.0, 2.9.0, 2.9.5, 2.9.9, 3.0.0, 3.1.0, 3.2.0.  
**Completed source milestones folded into releases:** 2.4, 2.5, 2.6, 2.7.  
**Current release boundary:** 3.3.0 is shipped; active work is 3.3.x post-release hardening and UX completion.  
**Immediate follow-on:** 3.3.x host-execution, transport UX, privacy and operator hardening.  
**Next major planned milestone:** 3.4 Service Workbench.  
**Later strategic horizons:** Spec Health/Contract Intelligence v2, Fleet/Cloud Alpha, Team Platform, Enterprise, protocol/agent expansion.  
**Canonical milestone references:** `docs/api-client-roadmap.md` and `docs/releases/3.3.md`.

## A.2 Old P0 backlog mapping

| August P0 | Current state |
|---|---|
| Unsafe rendering/XSS hardening | Old renderer architecture superseded; keep adversarial rendering tests/security review as ongoing quality work |
| One-renderer architecture | Done |
| Cycle-safe refs | Done for tested local/external/recursive compatibility paths |
| Immutable normalization discipline | Current canonical model should preserve; no longer an architecture blocker |
| Remote `specUrl` / refs | External refs supported with constraints |
| Remove runtime CDN dependency | Canonical bundled assets are the contract |
| Correct README/package/license metadata | Package/release trust materially improved; license remains AGPL and should be explicitly documented |
| Reproducible releases | Materially improved; continue tag/artifact provenance discipline |
| OpenAPI corpus | Done and active |
| OAS 3.1/composition/ref foundation | Done with explicit partial areas |
| Canonical request model + Try It | Done and expanded into API Client |
| Auth/environment/server model | Done and expanded |
| URL/deep links/search/responsive/accessibility | No longer strategic blockers; maintain through ordinary product QA |

---

# Appendix B — 3.3 runtime/package coverage

The 3.3 source tree documents the host-execution contract across the following current native package lines:

| Ecosystem | Source/package line in 3.3 tree |
|---|---|
| JavaScript coordinated product | `@prauga/flexdoc-client` 3.3.0 / `@prauga/flexdoc-backend` 3.3.0 release target |
| Python | `prauga-flexdoc` 0.7.2 source line |
| Java/JVM/JAX-RS/Spring | 0.8.2 source line |
| .NET ASP.NET Core | `Prauga.FlexDoc.AspNetCore` 0.5.2 source line |
| Rust Axum | `prauga-flexdoc-axum` 0.5.4 source line |
| Rust Actix | `prauga-flexdoc-actix` 0.4.4 source line |
| Ruby | `prauga-flexdoc` 0.4.4 source line |
| Elixir | `prauga_flexdoc` 0.4.4 source line |
| PHP | `prauga/flexdoc` 0.4.4 source line |
| Go | `github.com/prauga/flexdoc/adapters/go` 0.5.4 source/tag line |

These numbers identify the current 3.3 source tree’s package metadata/compatibility set; native ecosystems remain independently versioned and must follow their own immutable registry/tag semantics at publication time.

---

# Appendix C — security checklist for every new backend-native feature

Before merging a new runtime/diagnostic/execution capability, answer all of the following:

1. What backend/service information does the feature expose?
2. Can the same data reveal secrets, topology, user identity, request bodies or infrastructure details?
3. Is the feature read-only, or can it execute network/actions?
4. What application authentication/authorization protects it?
5. Is capability support explicit and fail closed?
6. Does it add global application middleware or hot-path work?
7. What is the measured CPU/memory/latency overhead?
8. What are the size, time and concurrency bounds?
9. If it performs network access, what exact allowlist and SSRF controls apply?
10. If it follows redirects or resolves DNS, how are destinations revalidated?
11. Can proxy configuration bypass validation?
12. What credentials/headers/bodies can reach logs or history?
13. What is retained, for how long, and how can a user delete it?
14. What negative tests prove the security boundary?
15. How does the feature behave on frameworks where evidence is incomplete?
16. Can the renderer distinguish “unsupported,” “partial,” “healthy” and “no data”?
17. Does the feature preserve local/self-hosted operation without required telemetry?
18. Does the capability strengthen the backend-native moat, or is it generic parity that should be deprioritized?

---

# Evidence basis

This strategy originated from the 15 September 2026 repository review and was updated after the 3.3 publication to reflect the shipped `js/v3.3.0` release, the native adapter release matrix, and the move into 3.3.x post-release hardening. GitHub issues/implementation PRs are now the executable status source for named R33/HX/UX/OBS/PRH work; this document remains the prioritization and architectural strategy source. Competitive context remains based on the September 2026 product/pricing review of Scalar, ReadMe, Fern, Mintlify and Redocly.

The document intentionally distinguishes shipped functionality, in-progress post-release/source work and future strategy. Future milestones after 3.4 are strategic horizons rather than committed release numbers or dates.