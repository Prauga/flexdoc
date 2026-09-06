# API Client roadmap: FlexDoc 2.3.0 → 2.9 (in progress)

FlexDoc 2.3.0 was the last coordinated product release before the API Client workspace grew through several focused development milestones. Those milestone numbers described source-development slices; they were not separate published FlexDoc package releases. The coordinated product line moved directly from published **2.3.0** to published **2.8.0** after the 2.8 source definition of done was satisfied.

The current published coordinated product line remains **2.8.0**. FlexDoc **2.9 is source work in progress**; the capabilities recorded below do not imply that 2.9 packages have been published or that every planned product control is available in `ApiClientWorkspace` yet.

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
| **2.9** | shared request executor, collection/folder runner product UI, scripting IntelliSense, grouped run history, and full request-history inspector | in progress |

Viewer expansion defaults/settings and renderer-option parity landed before the 2.8 release and are included in the 2.8 product surface.

## Architecture rule

The standalone `ApiClientWorkspace` is the API-development product surface. Importers are adapters into its canonical workspace model; they must not introduce a Postman-specific request engine, persistence model, auth resolver, script executor, or history store.

Imported data should become ordinary FlexDoc collections, folders, requests, variables, environments, auth settings, and scripts immediately after conversion. Unsupported source behavior must produce an explicit warning instead of being silently reinterpreted.

## 2.9 source work in progress

The current 2.9 source now surfaces the collection runner in `ApiClientWorkspace`, while the milestone remains in progress until final release hardening and deliberate version advancement.

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

## Release interpretation

Do not retroactively publish artificial 2.4.0, 2.5.0, 2.6.0, or 2.7.0 releases just to fill the numeric gap. They are recorded here as development milestones. The coordinated JavaScript product release is **2.8.0**, published directly after 2.3.0; 2.9 remains an in-progress source milestone until its release definition is completed and versions are deliberately advanced.

For native adapters, each package remains on its independently versioned semantic-release line while carrying the current coordinated renderer. `@prauga/flexdoc-core` remains independently versioned unless the framework-neutral engine itself changes. The CLI also remains independently versioned and consumes the coordinated client line.