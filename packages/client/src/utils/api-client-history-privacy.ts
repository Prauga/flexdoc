import type { ApiClientWorkspaceState } from './api-client-workspace';
import { sanitizeApiClientAuthCredentials } from './api-client-credentials';
import type { HttpKeyValue, HttpRequestDraft } from './http-client';

const REDACTED_HISTORY_VALUE = '[REDACTED]';

function normalizedSensitiveName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveName(name: string): boolean {
  const normalized = normalizedSensitiveName(name);
  return normalized.includes('authorization')
    || normalized.includes('cookie')
    || normalized.includes('token')
    || normalized.includes('signature')
    || normalized.includes('secret')
    || normalized.includes('password')
    || normalized.endsWith('key');
}

/** Return whether a header value should never be written verbatim to request history. */
export function isSensitiveApiClientHistoryHeader(name: string): boolean {
  return isSensitiveName(name);
}

function redactRequestHeaders(headers: HttpKeyValue[] | undefined): HttpKeyValue[] | undefined {
  return headers?.map((entry) => isSensitiveApiClientHistoryHeader(entry.key)
    ? { ...entry, value: REDACTED_HISTORY_VALUE }
    : entry);
}

function redactQueryEntries(entries: HttpKeyValue[] | undefined): HttpKeyValue[] | undefined {
  return entries?.map((entry) => isSensitiveName(entry.key)
    ? { ...entry, value: REDACTED_HISTORY_VALUE }
    : entry);
}

function redactResponseHeaders(headers: Array<[string, string]> | undefined): Array<[string, string]> | undefined {
  return headers?.map((entry) => isSensitiveApiClientHistoryHeader(entry[0])
    ? [entry[0], REDACTED_HISTORY_VALUE]
    : entry);
}

function redactUrlQuery(url: string): string {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const withoutFragment = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) return url;
  const base = withoutFragment.slice(0, queryIndex);
  const query = withoutFragment.slice(queryIndex + 1).split('&').map((part) => {
    if (!part) return part;
    const equals = part.indexOf('=');
    const rawName = equals >= 0 ? part.slice(0, equals) : part;
    let name = rawName;
    try { name = decodeURIComponent(rawName.replace(/\+/g, ' ')); } catch { /* preserve malformed query keys */ }
    return isSensitiveName(name) ? `${rawName}=${encodeURIComponent(REDACTED_HISTORY_VALUE)}` : part;
  }).join('&');
  return `${base}?${query}${fragment}`;
}

function persistedRequest(request: HttpRequestDraft, omitBody: boolean): HttpRequestDraft {
  const copy = {
    ...request,
    url: redactUrlQuery(request.url),
    query: redactQueryEntries(request.query),
    headers: redactRequestHeaders(request.headers),
    auth: sanitizeApiClientAuthCredentials(request.auth),
  };
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
 * Credentials in auth/query/URL/header fields are always redacted. When host-body persistence
 * is disabled, positively identified browser executions retain bodies while API-host and
 * legacy/unknown executions omit request and response payloads.
 */
export function createApiClientWorkspacePersistenceSnapshot(workspace: ApiClientWorkspaceState): ApiClientWorkspaceState {
  return {
    ...workspace,
    history: workspace.history.map((entry) => {
      const omitBody = workspace.historyBodies === false && entry.transport !== 'browser';
      const bodyFree = {
        ...entry,
        resolvedUrl: redactUrlQuery(entry.resolvedUrl),
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
