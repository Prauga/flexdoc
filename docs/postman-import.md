# Postman import compatibility

FlexDoc imports Postman data into the existing standalone `ApiClientWorkspace`. Imported data becomes ordinary FlexDoc collections, folders, saved requests, variables, environments, auth settings, and scripts; FlexDoc does not retain a parallel Postman-specific request or persistence model.

## Browser workflow

Use **Import Postman** in the standalone API Client workspace and select one or more exported JSON files. Collection and environment exports can be selected together. Successful files are merged even when another selected file fails, and compatibility warnings are shown for imported behavior that needs review.

Imported workspace data follows the normal IndexedDB persistence behavior of `ApiClientWorkspace`, so imported collections, environments, and requests survive reload when persistence is enabled.

## Supported collection mapping

Postman Collection v2.1 imports the following into the canonical workspace model:

- collections and collection variables;
- arbitrary nested folders;
- saved request names and folder placement;
- request methods, URLs, path variables, ordered query parameters, and headers;
- No Auth, bearer, Basic, API-key, OAuth 2.0, Digest, Hawk, OAuth 1.0, AWS Signature V4, and NTLM auth intent;
- raw, URL-encoded, GraphQL, multipart, and binary/file request-body intent;
- compatible collection, folder, and request pre-request/test scripts.

Postman `:pathVariable` URL syntax is converted to FlexDoc `{{pathVariable}}` templates so imported requests use the same variable resolver as native workspace requests.

Advanced auth is imported into the same canonical request/collection/folder auth model rather than a Postman-only representation. Digest, Hawk, OAuth 1.0, AWS Signature V4, cookie API keys, and NTLM require an API host that advertises the corresponding capability. The importer preserves those settings and emits a compatibility warning explaining that execution depends on host support. In 2.9.5 the Node executor advertises Digest, Hawk, OAuth 1.0, AWS Signature V4, cookies, and configured client certificates; it does not advertise NTLM.

## Environments

Exported Postman environment JSON imports as a named FlexDoc environment. Enabled and disabled values are preserved, and imported environments participate in the normal FlexDoc variable precedence rules.

When a workspace has no active environment, the first imported environment becomes active. Importing another environment does not otherwise replace the current active selection.

## Scripts

The importer translates the common Postman scripting APIs that map directly to FlexDoc's trusted `flex.*` scripting runtime, including collection/environment access, tests, expectations, request data, and response data where supported.

Collection- and folder-level Postman scripts are flattened into each imported request's saved script bundle at import time. FlexDoc does not retain them as shared collection/folder runtime objects, so later edits must be applied to the affected FlexDoc requests rather than expecting Postman-style shared-script propagation.

Postman scripts are not treated as fully compatible JavaScript merely because they parse. APIs without a FlexDoc equivalent, such as Postman request chaining or other sandbox-specific globals, are retained only when useful for review and produce an explicit compatibility warning. Review warnings before relying on imported scripts.

As with native FlexDoc request scripts, imported scripts execute in the documentation page context and are not a security sandbox. Import and execute only scripts you trust.

## Multipart, binary, and files

FlexDoc 2.9.5 models request bodies as first-class `none`, `json`, `raw`, `urlencoded`, `formdata`, `binary`, and `graphql` modes. Postman URL-encoded fields, GraphQL query/variables, multipart text fields, and file/binary intent therefore remain structured after import.

A Postman export contains local file paths rather than browser `File` objects. Multipart file rows and binary bodies retain re-selectable file metadata, but the actual file must be selected again before sending. Local file bytes are not silently persisted into the workspace.

## Compatibility warnings

Source behavior that FlexDoc cannot execute faithfully is not silently reinterpreted. The importer leaves unsupported options intact where the canonical model can represent the intent and emits a warning describing the execution limitation; behavior with no canonical representation falls back to inherited/default behavior with an explicit warning.

Warnings are especially important for partially supported Postman scripting APIs, source-local files, auth options that require an unavailable API-host capability, and unknown auth/body variants.

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

Treat `warnings` as part of the import result rather than optional diagnostics: they identify source behavior FlexDoc cannot represent or execute faithfully and should be reviewed before executing imported requests.
