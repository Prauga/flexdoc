import type { ApiClientTransport } from './api-client-execution';
import { cloneRequestDraft } from './api-client-workspace';
import type { ApiClientWorkspaceState } from './api-client-workspace';
import type { HttpKeyValue, HttpRequestDraft } from './http-client';

const REDACTED_HISTORY_VALUE = '[REDACTED]';
const SENSITIVE_HISTORY_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'api-key',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-amz-security-token',
  'x-functions-key',
  'x-goog-api-key',
]);

/** Privacy controls applied only to the workspace copy written to IndexedDB. */
export interface ApiClientHistoryPersistencePrivacyOptions {
  /** Keep API-host request/response bodies in IndexedDB. Defaults to true. */
  persistHostHistoryBodies?: boolean;
  /** Exact transport observed for history entries created in the current session. */
  transportByHistoryId?: ReadonlyMap<string, ApiClientTransport>;
}

/** Return whether a header value should never be written verbatim to request history. */
export function isSensitiveApiClientHistoryHeader(name: string): boolean {
  return SENSITIVE_HISTORY_HEADERS.has(name.trim().toLowerCase());
}

function redactRequestHeaders(headers: HttpKeyValue[] | undefined): HttpKeyValue[] | undefined {
  return headers?.map((entry) => isSensitiveApiClientHistoryHeader(entry.key)
    ? { ...entry, value: REDACTED_HISTORY_VALUE }
    : { ...entry });
}

function redactResponseHeaders(headers: Array<[string, string]> | undefined): Array<[string, string]> | undefined {
  return headers?.map(([name, value]) => [name, isSensitiveApiClientHistoryHeader(name) ? REDACTED_HISTORY_VALUE : value]);
}

function persistedRequest(request: HttpRequestDraft, omitBody: boolean): HttpRequestDraft {
  const copy = cloneRequestDraft(request);
  copy.headers = redactRequestHeaders(copy.headers);
  if (!omitBody) return copy;
  delete copy.body;
  delete copy.urlencoded;
  delete copy.formData;
  delete copy.binary;
  delete copy.graphql;
  return copy;
}

/**
 * Create the workspace representation written to IndexedDB without mutating live history.
 * Sensitive request/response headers are always redacted. When host-body persistence is
 * disabled, positively identified browser executions retain bodies while API-host and
 * legacy/unknown executions omit request and response payloads.
 */
export function createApiClientWorkspacePersistenceSnapshot(
  workspace: ApiClientWorkspaceState,
  options: ApiClientHistoryPersistencePrivacyOptions = {},
): ApiClientWorkspaceState {
  const persistHostBodies = options.persistHostHistoryBodies !== false;
  return {
    ...workspace,
    history: workspace.history.map((entry) => {
      const transport = options.transportByHistoryId?.get(entry.id);
      const omitBody = !persistHostBodies && transport !== 'browser';
      const request = persistedRequest(entry.request, omitBody);
      const responseHeaders = redactResponseHeaders(entry.responseHeaders);
      if (!omitBody) return {
        ...entry,
        request,
        ...(responseHeaders ? { responseHeaders } : {}),
      };
      const { responseBody: _responseBody, responseBodyTruncated: _responseBodyTruncated, ...bodyFree } = entry;
      return {
        ...bodyFree,
        request,
        ...(responseHeaders ? { responseHeaders } : {}),
      };
    }),
  };
}
