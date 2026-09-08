# FlexDoc 3.2 Headless Runner

FlexDoc 3.2 takes the canonical API Client request/script/collection model outside the browser. It does **not** add a second request engine, a second `__flexdoc/execute` endpoint, or native host execution.

The architectural rule remains:

> Could Scalar implement this without being installed inside the backend?

The Runner itself is portable CLI/CI infrastructure. Its backend-native value comes from consuming the host-execution contract FlexDoc already advertises because it is installed inside the application. 3.2 must therefore reuse that contract exactly rather than reimplement it.

## Baseline reused from 2.9/2.9.5

3.2 treats these as existing infrastructure:

- `executeApiClientRequest` is the canonical request/script/test executor;
- `runApiClientCollection` is the canonical saved-order collection/folder runner;
- Node host execution already uses `POST <docsPath>/__flexdoc/execute` plus `X-FlexDoc-Execute: 1`;
- host execution already advertises availability/capabilities through the browser-safe FlexDoc options emitted by the docs page;
- Node already owns its allowlist, metadata-IP protection, redirect rules, time/size bounds, cookies, certificates, Digest, Hawk, OAuth 1.0, and AWS Sig V4 behavior;
- native adapters that do not implement execution remain honest with `available: false` and do not register a fake execute route;
- docs authentication is already shared by Runtime Intelligence and host execution.

None of those are reintroduced as 3.2 inventions.

## Portable artifact

A Runner artifact is a versioned, history-free subset of `ApiClientWorkspaceState`:

```json
{
  "kind": "flexdoc-runner",
  "version": 1,
  "exportedAt": "2026-09-08T12:00:00.000Z",
  "scope": {
    "type": "collection",
    "collectionId": "collection-123"
  },
  "workspace": {
    "version": 6,
    "collections": [],
    "folders": [],
    "requests": [],
    "environments": [],
    "history": []
  }
}
```

Supported scopes:

- one saved request;
- one folder subtree;
- one collection.

The artifact preserves the existing workspace entities rather than translating them into Runner-specific request objects. This keeps:

- saved-request ordering;
- nested folder identity and auth ancestry;
- collection/folder/request auth;
- collection variables;
- request drafts and scripts;
- the selected workspace environment.

History is never exported. A request export retains only the folder ancestor chain required to resolve inherited auth. A folder export retains its descendant subtree plus any ancestors required for inherited auth. A collection export retains that collection's complete folder/request scope.

The workspace UI exports the currently active environment by default. Artifact JSON can contain request credentials, collection variables, and environment values exactly as stored in the workspace, so it must be treated as potentially sensitive configuration and must not be committed blindly. The workspace shows this warning next to the Runner export controls. 3.2 does not pretend there is already a host-side secret-store protocol; that is separate backend-execution work.

In-memory browser `File` objects are not valid portable JSON. The first artifact contract rejects multipart/binary requests that still contain an in-memory file payload instead of silently serializing `{}` or producing a request that cannot be replayed. A later portable file representation must be explicit and versioned.

Portable artifacts are deliberately stricter than IndexedDB migration input. Version 1 requires a canonical workspace-v6 snapshot with empty History; the parser rejects legacy versions, duplicate collection/folder/request/environment identifiers, or entity data that `normalizeApiClientWorkspace` would otherwise drop or repair. This prevents a corrupt CI artifact from silently shrinking its executable request set or making per-request evidence ambiguous and then reporting success on the remainder.

The declared scope is also closed over the embedded workspace. A request artifact must contain exactly that request plus only its auth-ancestor folders; a folder artifact may contain only that folder subtree plus auth ancestors; every artifact contains exactly one scoped collection and at most one selected environment. Extra executable entities behind a narrower scope label are rejected before transport begins.

## `flexdoc run`

```bash
flexdoc run ./pets.flexdoc.json
```

The CLI parses the artifact and calls the same `runApiClientCollection` / `executeApiClientRequest` path used by the UI.

For a request-scoped artifact, the artifact contains one saved request, so collection execution naturally produces one run item without adding a separate single-request runner.

### Execution ordering

The existing Runner ordering remains authoritative:

1. select saved requests in `workspace.requests` order;
2. compute collection variables;
3. merge external/environment values using the existing precedence rules;
4. execute the pre-request `flex.*` script in the CLI process;
5. resolve inherited auth;
6. resolve request placeholders into the execution draft;
7. choose direct or existing advertised host transport using canonical execution requirements;
8. execute transport;
9. execute response tests in the CLI process;
10. apply collection/environment script mutations before the next saved request.

A pre-request script error stops that item before transport. The canonical workspace Runner does not create a History row in that case; the headless report records the script failure without inventing an HTTP status or executor.

### Runner pass/fail

Runner health is intentionally independent of HTTP status.

An item fails when it has:

- a transport/build error;
- a pre-request/test script error; or
- at least one failed `flex.test(...)` assertion.

HTTP `4xx`/`5xx` alone does not make an item fail. Tests can intentionally assert an expected error response.

`--stop-on-failure` stops before the next saved request after the first failed item. Without it, execution continues through the selected scope.

### Cancellation

The CLI owns an `AbortController` for the run. SIGINT/SIGTERM or an embedding caller's abort signal is forwarded through `runApiClientCollection` to the active fetch.

This preserves the existing Runner rule: Stop/cancel aborts transport, not arbitrary JavaScript execution. A script phase that is already running follows the same script-runtime behavior as the UI rather than being killed by a second CLI-only sandbox implementation.

## Direct and host transport

Headless execution has no `browser` executor label. A report item records:

- `direct` when the CLI performs the target HTTP request;
- `host` when the canonical executor sends the resolved draft to the already advertised FlexDoc execute endpoint;
- `null` when transport never starts.

### Direct

Direct mode uses the canonical request builder and Node's Fetch implementation.

```bash
flexdoc run ./pets.flexdoc.json
```

### Existing host execution

Provide the FlexDoc documentation page when the artifact contains requests that need existing host capabilities:

```bash
flexdoc run ./pets.flexdoc.json --host https://api.example.com/docs
```

The CLI loads that page and reads the public `tryIt.hostExecution` advertisement already consumed by the renderer. Discovery accepts both the spaced Node assignment and compact/minified native `window.__FLEXDOC_OPTIONS__={...};</script>` form. Supplying `--host` is fail-closed: if the page does not contain a valid advertisement, the run fails before target transport; an honest `available: false` advertisement remains valid. The CLI does not probe for or invent an execute route.

When `executeApiClientRequest` determines that a request needs an advertised host capability, it sends the **already script-mutated and variable-resolved draft** through the existing host envelope. Host capability/allowlist/security semantics remain owned by the installed backend.

3.2 does not force ordinary direct requests through the host merely because `--host` was supplied. Private/VPC target policy and deliberate force-host workflows belong to 3.3 Backend Execution Expansion.

## Protected docs/execute endpoints

Runner host discovery and host execution reuse the Contract Validation CLI authentication flags:

```text
--header <name:value>
--bearer <token>
--basic <user:password>
```

`--header` is repeatable. Bearer/basic are mutually exclusive and cannot be combined with an explicit `Authorization` header.

These flags authenticate the **FlexDoc docs host** and advertised `__flexdoc/execute` endpoint only. The wrapper deliberately does not forward them to a direct target API request. Target API auth remains part of the canonical saved request/folder/collection/environment model.

Authenticated docs discovery follows redirects manually, with a five-redirect limit, and only while every destination remains on the original docs origin. A cross-origin redirect is rejected before the next request is sent, so custom CI/Authorization headers are not forwarded to another origin. The advertised execute endpoint must likewise resolve to the docs-page origin.

Authenticated host-execution envelopes also use manual redirect handling. The FlexDoc execute route is expected to answer directly; automatic redirect following is disabled so docs credentials cannot leave the advertised endpoint through an HTTP redirect. Target-API redirect policy inside the installed Node executor remains the existing backend host-execution responsibility.

## Machine-readable report

`flexdoc run --json` and `--report <file>` produce `flexdoc-run-report` version 1.

The report contains:

- run/artifact identity and scope;
- aggregate status and counts;
- start/end/duration;
- stable per-run item identity (`<runId>:<one-based-index>`) plus saved-request identity;
- actual executor (`direct` / `host` / `null`);
- HTTP status/status text and timing when transport completed;
- test results;
- transport and script errors.

Response bodies and response headers are intentionally not copied into the CI report. The workspace History/inspector remains the rich response-inspection contract; the Runner report is machine evidence, not Newman or a second history database.

Exit policy:

```text
0    all selected items passed
1    one or more items failed / stop-on-failure ended the run
130  interrupted/cancelled
```

## 3.2 definition of done

- [x] workspace exports a portable request, folder, or collection artifact with the selected environment;
- [x] portable artifacts fail closed on malformed/migrated data and entities outside the declared scope;
- [x] `flexdoc run <artifact>` executes through the canonical Runner/executor and script runtime;
- [x] direct and existing advertised host execution are reported truthfully;
- [x] existing docs `--header` / `--bearer` / `--basic` authentication works for protected host execution without leaking onto direct targets or redirect destinations;
- [x] variable/auth/script/test ordering matches the workspace Runner;
- [x] stop-on-failure and cancellation match existing Runner semantics;
- [x] JSON reports expose request/item identity, executor, status, tests, timings, errors, and aggregate outcome;
- [x] native adapters remain `available: false` unless/until they implement the existing envelope in 3.3;
- [x] unit/CLI/browser/package checks prove artifact export and headless execution on the final source head.

## Explicit non-goals

3.2 does not add:

- another Node executor or another execute endpoint;
- native host execute implementations;
- NTLM/Negotiate/Kerberos expansion;
- host-side secret-store semantics;
- runtime-derived host environment injection;
- private/VPC target policy changes;
- CSV/JSON iteration datasets;
- concurrency controls;
- drag-and-drop execution ordering;
- Newman compatibility;
- MDX/guides, docs versioning, git previews, custom domains, SEO, analytics, or a hosted docs control plane.

Native execution and deeper backend/private-network context remain the 3.3 programme. Portal/documentation-product work remains a separate product line.
