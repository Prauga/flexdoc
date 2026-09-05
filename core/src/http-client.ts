import type { BuiltRequest } from './request-builder.js';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'bearer'; token: string }
  | { type: 'oauth2'; accessToken: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; in: 'header' | 'query' };

export interface HttpRequestDraft {
  method: string;
  url: string;
  query?: HttpKeyValue[];
  headers?: HttpKeyValue[];
  body?: string;
  contentType?: string;
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
  if (auth.type === 'oauth2') return { type: 'oauth2', accessToken: resolveTemplateValue(auth.accessToken, variables) || '' };
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
  if (resolvedDraft.body && !['GET', 'HEAD'].includes(method)) {
    body = resolvedDraft.body;
    requestBody = resolvedDraft.body;
    const explicitContentType = findHeader(headerEntries, 'Content-Type');
    const requestedContentType = resolvedDraft.contentType?.trim();
    if (!explicitContentType && requestedContentType) headerEntries.push(['Content-Type', requestedContentType]);
    const contentType = explicitContentType || requestedContentType;
    bodyKind = contentType?.includes('json') ? 'json' : contentType === 'application/x-www-form-urlencoded' ? 'form' : contentType?.startsWith('multipart/form-data') ? 'multipart' : 'text';
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
  return {
    method: request.method,
    url: split.url,
    query: split.query,
    headers: entries.map(([key, value]) => ({ key, value })),
    body: request.body,
    contentType: findHeader(entries, 'Content-Type'),
    auth: { type: 'none' },
  };
}
