import type { BuiltRequest } from './request-builder.js';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpBodyMode = 'none' | 'raw' | 'json' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';

export interface HttpFormDataEntry extends HttpKeyValue {
  type?: 'text' | 'file';
  file?: File;
  fileName?: string;
  contentType?: string;
}

export interface HttpGraphqlBody {
  query: string;
  variables: string;
}

export interface HttpBinaryBody {
  file?: File;
  fileName?: string;
  contentType?: string;
}

export type HttpOAuth2GrantType = 'accessToken' | 'authorizationCode' | 'clientCredentials' | 'password' | 'implicit';

export interface HttpOAuth2Auth {
  type: 'oauth2';
  accessToken: string;
  grantType?: HttpOAuth2GrantType;
  authorizationUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientAuthentication?: 'body' | 'basic';
  redirectUri?: string;
  scopes?: string[];
  username?: string;
  password?: string;
  refreshToken?: string;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'bearer'; token: string }
  | HttpOAuth2Auth
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; in: 'header' | 'query' };

export interface HttpRequestDraft {
  method: string;
  url: string;
  query?: HttpKeyValue[];
  headers?: HttpKeyValue[];
  body?: string;
  contentType?: string;
  bodyMode?: HttpBodyMode;
  urlencoded?: HttpKeyValue[];
  formData?: HttpFormDataEntry[];
  binary?: HttpBinaryBody;
  graphql?: HttpGraphqlBody;
  auth?: HttpAuth;
}

export type HttpVariables = Record<string, string>;

export interface HttpRequestBuildOptions {
  variables?: HttpVariables;
}

/**
 * Arbitrary HTTP requests retain their ordered header entries in addition to
 * the legacy record view exposed by BuiltRequest. The ordered entries are the
 * canonical representation for execution because a record cannot represent
 * duplicate header names.
 */
export interface HttpBuiltRequest extends BuiltRequest {
  headerEntries: Array<[string, string]>;
}

function enabledPairs(entries: HttpKeyValue[] | undefined): HttpKeyValue[] {
  return (entries || []).filter((entry) => entry.enabled !== false && entry.key.trim() !== '');
}

export function inferHttpBodyMode(draft: Partial<HttpRequestDraft>): HttpBodyMode {
  if (draft.bodyMode) return draft.bodyMode;
  if (draft.binary?.file || draft.binary?.fileName) return 'binary';
  if (draft.formData?.length) return 'formdata';
  if (draft.urlencoded?.length) return 'urlencoded';
  if (draft.graphql && (draft.graphql.query || draft.graphql.variables)) return 'graphql';
  if (!draft.body) return 'none';
  const contentType = (draft.contentType || '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded')) return 'urlencoded';
  if (contentType.includes('multipart/form-data')) return 'formdata';
  if (contentType.includes('json')) return 'json';
  return 'raw';
}

function appendQuery(url: string, entries: HttpKeyValue[]): string {
  if (!entries.length) return url;
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const encoded = entries.map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const separator = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${separator}${encoded}${fragment}`;
}

function splitQuery(url: string): { url: string; query: HttpKeyValue[] } {
  const hashIndex = url.indexOf('#');
  const beforeFragment = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const queryIndex = beforeFragment.indexOf('?');
  if (queryIndex < 0) return { url, query: [] };

  const query: HttpKeyValue[] = [];
  const search = new URLSearchParams(beforeFragment.slice(queryIndex + 1));
  search.forEach((value, key) => query.push({ key, value }));

  return {
    url: `${beforeFragment.slice(0, queryIndex)}${fragment}`,
    query,
  };
}

function findHeader(entries: Array<[string, string]>, name: string): string | undefined {
  return entries.find(([candidate]) => candidate.toLowerCase() === name.toLowerCase())?.[1];
}

function replaceHeader(entries: Array<[string, string]>, name: string, value: string): void {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index][0].toLowerCase() === name.toLowerCase()) entries.splice(index, 1);
  }
  entries.push([name, value]);
}

function headerRecord(entries: Array<[string, string]>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of entries) headers[name] = value;
  return headers;
}

function normalizeHeaderEntries(request: BuiltRequest & { headerEntries?: unknown }): Array<[string, string]> {
  const raw = request.headerEntries;
  if (!Array.isArray(raw)) return Object.entries(request.headers || {});
  const normalized: Array<[string, string]> = [];
  for (const entry of raw) {
    if (Array.isArray(entry) && entry.length >= 2) {
      normalized.push([String(entry[0]), String(entry[1])]);
      continue;
    }
    if (entry && typeof entry === 'object' && 'key' in entry && 'value' in entry) {
      const item = entry as { key: unknown; value: unknown; enabled?: boolean };
      if (item.enabled !== false) normalized.push([String(item.key), String(item.value)]);
    }
  }
  return normalized.length || raw.length === 0 ? normalized : Object.entries(request.headers || {});
}

function encodeBasicCredential(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    if (typeof TextEncoder === 'undefined') throw new Error('Basic auth requires UTF-8 encoding support.');
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
  }
  const BufferCtor = (globalThis as any).Buffer;
  if (BufferCtor?.from) return BufferCtor.from(value, 'utf8').toString('base64');
  throw new Error('Basic auth requires a Base64 encoder in this runtime.');
}

function resolveTemplateValue(value: string | undefined, variables: HttpVariables): string | undefined {
  if (value === undefined || value === '') return value;
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
}

function resolveAuthVariables(auth: HttpAuth | undefined, variables: HttpVariables): HttpAuth | undefined {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return auth;
  if (auth.type === 'bearer') return { type: 'bearer', token: resolveTemplateValue(auth.token, variables) || '' };
  if (auth.type === 'oauth2') {
    const resolved: HttpOAuth2Auth = {
      ...auth,
      accessToken: resolveTemplateValue(auth.accessToken, variables) || '',
    };
    if (auth.authorizationUrl !== undefined) resolved.authorizationUrl = resolveTemplateValue(auth.authorizationUrl, variables);
    if (auth.tokenUrl !== undefined) resolved.tokenUrl = resolveTemplateValue(auth.tokenUrl, variables);
    if (auth.clientId !== undefined) resolved.clientId = resolveTemplateValue(auth.clientId, variables);
    if (auth.clientSecret !== undefined) resolved.clientSecret = resolveTemplateValue(auth.clientSecret, variables);
    if (auth.redirectUri !== undefined) resolved.redirectUri = resolveTemplateValue(auth.redirectUri, variables);
    if (auth.scopes !== undefined) resolved.scopes = auth.scopes.map((scope) => resolveTemplateValue(scope, variables) || '');
    if (auth.username !== undefined) resolved.username = resolveTemplateValue(auth.username, variables);
    if (auth.password !== undefined) resolved.password = resolveTemplateValue(auth.password, variables);
    if (auth.refreshToken !== undefined) resolved.refreshToken = resolveTemplateValue(auth.refreshToken, variables);
    return resolved;
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      username: resolveTemplateValue(auth.username, variables) || '',
      password: resolveTemplateValue(auth.password, variables) || '',
    };
  }
  return {
    type: 'apiKey',
    key: resolveTemplateValue(auth.key, variables) || '',
    value: resolveTemplateValue(auth.value, variables) || '',
    in: auth.in,
  };
}

export function resolveHttpRequestDraftVariables(draft: HttpRequestDraft, variables: HttpVariables): HttpRequestDraft {
  return {
    method: resolveTemplateValue(draft.method, variables) ?? draft.method,
    url: resolveTemplateValue(draft.url, variables) ?? draft.url,
    query: draft.query?.map((entry) => ({
      ...entry,
      key: resolveTemplateValue(entry.key, variables) || '',
      value: resolveTemplateValue(entry.value, variables) || '',
    })),
    headers: draft.headers?.map((entry) => ({
      ...entry,
      key: resolveTemplateValue(entry.key, variables) || '',
      value: resolveTemplateValue(entry.value, variables) || '',
    })),
    body: resolveTemplateValue(draft.body, variables),
    contentType: resolveTemplateValue(draft.contentType, variables),
    bodyMode: draft.bodyMode,
    urlencoded: draft.urlencoded?.map((entry) => ({
      ...entry,
      key: resolveTemplateValue(entry.key, variables) || '',
      value: resolveTemplateValue(entry.value, variables) || '',
    })),
    formData: draft.formData?.map((entry) => ({
      ...entry,
      key: resolveTemplateValue(entry.key, variables) || '',
      value: resolveTemplateValue(entry.value, variables) || '',
      fileName: resolveTemplateValue(entry.fileName, variables),
      contentType: resolveTemplateValue(entry.contentType, variables),
    })),
    binary: draft.binary ? {
      ...draft.binary,
      fileName: resolveTemplateValue(draft.binary.fileName, variables),
      contentType: resolveTemplateValue(draft.binary.contentType, variables),
    } : undefined,
    graphql: draft.graphql ? {
      query: resolveTemplateValue(draft.graphql.query, variables) || '',
      variables: resolveTemplateValue(draft.graphql.variables, variables) || '',
    } : undefined,
    auth: resolveAuthVariables(draft.auth, variables),
  };
}

function applyAuth(draft: HttpRequestDraft, headers: Array<[string, string]>, query: HttpKeyValue[]): void {
  const auth = draft.auth;
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return;
  if (auth.type === 'bearer') {
    if (auth.token) replaceHeader(headers, 'Authorization', `Bearer ${auth.token}`);
    return;
  }
  if (auth.type === 'oauth2') {
    if (auth.accessToken) replaceHeader(headers, 'Authorization', `Bearer ${auth.accessToken}`);
    return;
  }
  if (auth.type === 'basic') {
    if (auth.username || auth.password) replaceHeader(headers, 'Authorization', `Basic ${encodeBasicCredential(`${auth.username}:${auth.password}`)}`);
    return;
  }
  if (!auth.key) return;
  if (auth.in === 'query') query.push({ key: auth.key, value: auth.value });
  else replaceHeader(headers, auth.key, auth.value);
}

export function buildHttpRequest(draft: HttpRequestDraft, options: HttpRequestBuildOptions = {}): HttpBuiltRequest {
  const resolvedDraft = options.variables ? resolveHttpRequestDraftVariables(draft, options.variables) : draft;
  const method = (resolvedDraft.method || 'GET').trim().toUpperCase();
  const url = resolvedDraft.url.trim();
  if (!url) throw new Error('Request URL is required.');

  const query = enabledPairs(resolvedDraft.query);
  const headerEntries: Array<[string, string]> = enabledPairs(resolvedDraft.headers).map(({ key, value }) => [key, value]);
  applyAuth(resolvedDraft, headerEntries, query);

  let body: string | undefined;
  let bodyKind: BuiltRequest['bodyKind'];
  let requestBody: BodyInit | undefined;
  const bodyMode = inferHttpBodyMode(resolvedDraft);
  if (!['GET', 'HEAD'].includes(method) && bodyMode !== 'none') {
    if (bodyMode === 'formdata') {
      for (let index = headerEntries.length - 1; index >= 0; index -= 1) {
        if (headerEntries[index][0].toLowerCase() === 'content-type') headerEntries.splice(index, 1);
      }
    }
    const explicitContentType = findHeader(headerEntries, 'Content-Type');
    const requestedContentType = resolvedDraft.contentType?.trim();
    if (bodyMode === 'urlencoded') {
      const fields = enabledPairs(resolvedDraft.urlencoded);
      body = fields.map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
      requestBody = body;
      if (!explicitContentType) headerEntries.push(['Content-Type', requestedContentType || 'application/x-www-form-urlencoded']);
      bodyKind = 'form';
    } else if (bodyMode === 'formdata') {
      const form = new FormData();
      const preview: string[] = [];
      for (const entry of (resolvedDraft.formData || []).filter((item) => item.enabled !== false && item.key.trim() !== '')) {
        if (entry.type === 'file') {
          if (!entry.file) throw new Error(`File field "${entry.key}" needs a file selection.`);
          form.append(entry.key, entry.file, entry.fileName || entry.file.name);
          preview.push(`${entry.key}=[file: ${entry.fileName || entry.file.name}]`);
        } else {
          form.append(entry.key, entry.value);
          preview.push(`${entry.key}=${entry.value}`);
        }
      }
      body = preview.join('\n');
      requestBody = form;
      bodyKind = 'multipart';
    } else if (bodyMode === 'binary') {
      const binary = resolvedDraft.binary;
      if (!binary?.file) throw new Error('Binary body needs a file selection.');
      const fileName = binary.fileName || binary.file.name;
      body = `[file: ${fileName}]`;
      requestBody = binary.file;
      if (!explicitContentType) headerEntries.push(['Content-Type', requestedContentType || binary.contentType || binary.file.type || 'application/octet-stream']);
      bodyKind = 'binary';
    } else if (bodyMode === 'graphql') {
      const query = resolvedDraft.graphql?.query || '';
      const rawVariables = resolvedDraft.graphql?.variables?.trim() || '';
      let variables: unknown = {};
      if (rawVariables) {
        try { variables = JSON.parse(rawVariables); } catch { throw new Error('GraphQL variables must be valid JSON.'); }
      }
      body = JSON.stringify({ query, variables });
      requestBody = body;
      if (!explicitContentType) headerEntries.push(['Content-Type', requestedContentType || 'application/json']);
      bodyKind = 'json';
    } else {
      body = resolvedDraft.body || '';
      requestBody = body;
      const fallback = bodyMode === 'json' ? 'application/json' : undefined;
      if (!explicitContentType && (requestedContentType || fallback)) headerEntries.push(['Content-Type', requestedContentType || fallback!]);
      const contentType = explicitContentType || requestedContentType || fallback;
      bodyKind = bodyMode === 'json' || contentType?.includes('json') ? 'json' : 'text';
    }
  }

  const headers = headerRecord(headerEntries);
  const resolvedUrl = appendQuery(url, query);
  return {
    url: resolvedUrl,
    method,
    headers,
    headerEntries,
    body,
    bodyKind,
    init: { method, headers: headerEntries, body: requestBody },
  };
}

export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: unknown }): HttpRequestDraft {
  const entries = normalizeHeaderEntries(request);
  const split = splitQuery(request.url);
  const binaryFile = request.bodyKind === 'binary' && typeof File !== 'undefined' && request.init.body instanceof File ? request.init.body : undefined;
  return {
    method: request.method,
    url: split.url,
    query: split.query,
    headers: entries.map(([key, value]) => ({ key, value })),
    body: request.body,
    contentType: findHeader(entries, 'Content-Type'),
    bodyMode: request.bodyKind === 'json' ? 'json' : request.bodyKind === 'form' ? 'urlencoded' : request.bodyKind === 'multipart' ? 'formdata' : request.bodyKind === 'binary' ? 'binary' : request.body ? 'raw' : 'none',
    binary: request.bodyKind === 'binary' ? { file: binaryFile, fileName: binaryFile?.name, contentType: findHeader(entries, 'Content-Type') } : undefined,
    urlencoded: request.bodyKind === 'form' && request.body ? [...new URLSearchParams(request.body).entries()].map(([key, value]) => ({ key, value, enabled: true })) : undefined,
    auth: { type: 'none' },
  };
}
