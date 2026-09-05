# Postman import compatibility

FlexDoc 2.8 imports Postman data into the existing standalone `ApiClientWorkspace`. Imported data becomes ordinary FlexDoc collections, folders, saved requests, variables, environments, auth settings, and scripts; FlexDoc does not retain a parallel Postman-specific request or persistence model.

## Browser workflow

Use **Import Postman** in the standalone API Client workspace and select one or more exported JSON files. Collection and environment exports can be selected together. Successful files are merged even when another selected file fails, and compatibility warnings are shown for imported behavior that needs review.

Imported workspace data follows the normal IndexedDB persistence behavior of `ApiClientWorkspace`, so imported collections, environments, and requests survive reload when persistence is enabled.

## Supported collection mapping

Postman Collection v2.1 imports the following into the canonical workspace model:

- collections and collection variables;
- arbitrary nested folders;
- saved request names and folder placement;
- request methods, URLs, path variables, ordered query parameters, and headers;
- No Auth, bearer, Basic, API-key, and common OAuth 2.0 configuration;
- raw bodies, URL-encoded bodies, and GraphQL bodies;
- compatible collection, folder, and request pre-request/test scripts.

Postman `:pathVariable` URL syntax is converted to FlexDoc `{{pathVariable}}` templates so imported requests use the same variable resolver as native workspace requests.

## Environments

Exported Postman environment JSON imports as a named FlexDoc environment. Enabled and disabled values are preserved, and imported environments participate in the normal FlexDoc variable precedence rules.

When a workspace has no active environment, the first imported environment becomes active. Importing another environment does not otherwise replace the current active selection.

## Scripts

The importer translates the common Postman scripting APIs that map directly to FlexDoc's trusted `flex.*` scripting runtime, including collection/environment access, tests, expectations, request data, and response data where supported.

Collection- and folder-level Postman scripts are flattened into each imported request's saved script bundle at import time. FlexDoc does not retain them as shared collection/folder runtime objects, so later edits must be applied to the affected FlexDoc requests rather than expecting Postman-style shared-script propagation.

Postman scripts are not treated as fully compatible JavaScript merely because they parse. APIs without a FlexDoc equivalent, such as Postman request chaining or other sandbox-specific globals, are retained only when useful for review and produce an explicit compatibility warning. Review warnings before relying on imported scripts.

As with native FlexDoc request scripts, imported scripts execute in the documentation page context and are not a security sandbox. Import and execute only scripts you trust.

## Multipart and files

The current canonical `HttpRequestDraft` stores a textual request body and does not model imported browser `File` objects. Postman multipart form-data is therefore imported as a readable text representation and produces a compatibility warning. File fields cannot be reconstructed from paths stored in a Postman export.

Review multipart requests and attach/rebuild file payloads outside the importer before sending them.

## Unsupported authentication

Auth modes that do not map to the canonical FlexDoc auth model are not silently reinterpreted. The importer leaves them at inherited/default auth and emits a warning identifying the unsupported Postman auth type or option.

## Programmatic API

`@prauga/flexdoc-client` exports the same conversion helpers used by the browser workflow:

```ts
import {
  importPostmanCollection,
  importPostmanDocument,
  importPostmanEnvironment,
  mergePostmanCollectionImport,
  mergePostmanEnvironmentImport,
} from '@prauga/flexdoc-client';
```

`importPostmanDocument` detects supported collection and environment documents. The collection/environment-specific helpers return converted canonical workspace entities plus `warnings`. The merge helpers apply those results to an existing `ApiClientWorkspaceState` without introducing Postman-specific state.

Treat `warnings` as part of the import result rather than optional diagnostics: they identify source behavior FlexDoc cannot represent faithfully and should be reviewed before executing imported requests.