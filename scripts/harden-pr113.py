from pathlib import Path

privacy = Path('packages/client/src/utils/api-client-history-privacy.ts')
privacy.write_text("""import type { ApiClientWorkspaceState } from './api-client-workspace';
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
""")

credentials = Path('packages/client/src/utils/api-client-credentials.ts')
if not credentials.exists():
    credentials.write_text("""import type { HttpAuth } from './http-client';

/** Clone auth configuration while clearing credential material before browser persistence. */
export function sanitizeApiClientAuthCredentials(auth: HttpAuth | undefined): HttpAuth | undefined {
  if (!auth) return undefined;
  if (auth.type === 'bearer') return { ...auth, token: '' };
  if (auth.type === 'oauth2') return {
    ...auth,
    accessToken: '',
    ...(auth.clientSecret !== undefined ? { clientSecret: '' } : {}),
    ...(auth.password !== undefined ? { password: '' } : {}),
    ...(auth.refreshToken !== undefined ? { refreshToken: '' } : {}),
    scopes: auth.scopes ? [...auth.scopes] : undefined,
  };
  if (auth.type === 'basic' || auth.type === 'digest' || auth.type === 'ntlm') return { ...auth, password: '' };
  if (auth.type === 'apiKey') return { ...auth, value: '' };
  if (auth.type === 'hawk') return { ...auth, key: '' };
  if (auth.type === 'oauth1') return { ...auth, consumerSecret: '', ...(auth.token !== undefined ? { token: '' } : {}), ...(auth.tokenSecret !== undefined ? { tokenSecret: '' } : {}) };
  if (auth.type === 'awsv4') return { ...auth, secretKey: '', ...(auth.sessionToken !== undefined ? { sessionToken: '' } : {}) };
  return { ...auth };
}
""")

test = Path('packages/client/src/utils/api-client-history-privacy.test.ts')
s = test.read_text()
s = s.replace("url: 'https://api.example.test/pets',", "url: 'https://api.example.test/pets?access_token=url-secret&trace=ok',\n      query: [{ key: 'api_key', value: 'query-secret' }, { key: 'trace', value: 'ok' }],\n      auth: { type: 'bearer', token: 'auth-secret' },", 1)
s = s.replace("resolvedUrl: 'https://api.example.test/pets',", "resolvedUrl: 'https://api.example.test/pets?private_token=resolved-secret&trace=ok',", 1)
s = s.replace("expect(isSensitiveApiClientHistoryHeader('X-Amz-Security-Token')).toBe(true);", "expect(isSensitiveApiClientHistoryHeader('X-Amz-Security-Token')).toBe(true);\n    expect(isSensitiveApiClientHistoryHeader('X-CSRF-Token')).toBe(true);\n    expect(isSensitiveApiClientHistoryHeader('Ocp-Apim-Subscription-Key')).toBe(true);\n    expect(isSensitiveApiClientHistoryHeader('Private-Token')).toBe(true);\n    expect(isSensitiveApiClientHistoryHeader('X-Hub-Signature')).toBe(true);")
needle = "    expect(workspace.history[0].responseHeaders?.[0][1]).toBe('sid=secret');\n"
insert = """    expect(workspace.history[0].responseHeaders?.[0][1]).toBe('sid=secret');
    expect(snapshot.history[0].request.url).toBe('https://api.example.test/pets?access_token=%5BREDACTED%5D&trace=ok');
    expect(snapshot.history[0].resolvedUrl).toBe('https://api.example.test/pets?private_token=%5BREDACTED%5D&trace=ok');
    expect(snapshot.history[0].request.query).toEqual([{ key: 'api_key', value: '[REDACTED]' }, { key: 'trace', value: 'ok' }]);
    expect(snapshot.history[0].request.auth).toEqual({ type: 'bearer', token: '' });
    expect(workspace.history[0].request.auth).toEqual({ type: 'bearer', token: 'auth-secret' });
"""
if needle not in s:
    raise SystemExit('privacy test insertion point missing')
s = s.replace(needle, insert, 1)
test.write_text(s)
