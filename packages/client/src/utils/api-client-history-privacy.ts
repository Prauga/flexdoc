import type { ApiClientWorkspaceState } from './api-client-workspace';
import type { HttpKeyValue, HttpRequestDraft } from './http-client';

const REDACTED_HISTORY_VALUE = '[REDACTED]';
const SENSITIVE_HISTORY_HEADER = /authorization|cookie|(?:api|functions)[-_]?key|(?:auth|access|security)[-_]?token/i;

/** Return whether a header value should never be written verbatim to request history. */
export function isSensitiveApiClientHistoryHeader(name: string): boolean {
  return SENSITIVE_HISTORY_HEADER.test(name);
}

function redactRequestHeaders(headers: HttpKeyValue[] | undefined): HttpKeyValue[] | undefined {
  return headers?.map((entry) => isSensitiveApiClientHistoryHeader(entry.key)
    ? { ...entry, value: REDACTED_HISTORY_VALUE }
    : entry);
}

function redactResponseHeaders(headers: Array<[string, string]> | undefined): Array<[string, string]> | undefined {
  return headers?.map((entry) => isSensitiveApiClientHistoryHeader(entry[0])
    ? [entry[0], REDACTED_HISTORY_VALUE]
    : entry);
}

function persistedRequest(request: HttpRequestDraft, omitBody: boolean): HttpRequestDraft {
  const copy = { ...request, headers: redactRequestHeaders(request.headers) };
  if (omitBody) {
    delete copy.body;
    delete copy.urlencoded;
    delete copy.formData;
    delete copy.binary;
    delete copy.graphql;
  }
  return copy;
}

/**
 * Create the workspace representation written to IndexedDB without mutating live history.
 * Sensitive request/response headers are always redacted. When host-body persistence is
 * disabled, positively identified browser executions retain bodies while API-host and
 * legacy/unknown executions omit request and response payloads.
 */
export function createApiClientWorkspacePersistenceSnapshot(workspace: ApiClientWorkspaceState): ApiClientWorkspaceState {
  return {
    ...workspace,
    history: workspace.history.map((entry) => {
      const omitBody = workspace.historyBodies === false && entry.transport !== 'browser';
      const bodyFree = {
        ...entry,
        request: persistedRequest(entry.request, omitBody),
        responseHeaders: redactResponseHeaders(entry.responseHeaders),
      };
      if (omitBody) {
        delete bodyFree.responseBody;
        delete bodyFree.responseBodyTruncated;
      }
      return bodyFree;
    }),
  };
}
