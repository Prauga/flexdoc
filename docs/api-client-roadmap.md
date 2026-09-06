# API Client roadmap: FlexDoc 2.3.0 → 2.8.0

FlexDoc 2.3.0 was the last coordinated product release before the API Client workspace grew through several focused development milestones. Those milestone numbers described source-development slices; they were not separate published FlexDoc package releases. The coordinated product line moved directly from published **2.3.0** to published **2.8.0** after the 2.8 source definition of done was satisfied.

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

Viewer expansion defaults/settings and renderer-option parity landed before the 2.8 release and are included in the 2.8 product surface.

## Architecture rule

The standalone `ApiClientWorkspace` is the API-development product surface. Importers are adapters into its canonical workspace model; they must not introduce a Postman-specific request engine, persistence model, auth resolver, script executor, or history store.

Imported data should become ordinary FlexDoc collections, folders, requests, variables, environments, auth settings, and scripts immediately after conversion. Unsupported source behavior must produce an explicit warning instead of being silently reinterpreted.

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

Do not retroactively publish artificial 2.4.0, 2.5.0, 2.6.0, or 2.7.0 releases just to fill the numeric gap. They are recorded here as development milestones. The coordinated JavaScript product release is **2.8.0**, published directly after 2.3.0.

For native adapters, each package remains on its independently versioned semantic-release line while carrying the 2.8 renderer. `@prauga/flexdoc-core` remains independently versioned unless the framework-neutral engine itself changes. The CLI also remains independently versioned and consumes the coordinated 2.8 client line.
