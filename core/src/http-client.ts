import type { BuiltRequest } from './request-builder.js';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
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

function applyAuth(draft: HttpRequestDraft, headers: Array<[string, string]>, query: HttpKeyValue[]): void {
  const auth = draft.auth;
  if (!auth || auth.type === 'none') return;
  if (auth.type === 'bearer') {
    if (auth.token) replaceHeader(headers, 'Authorization', `Bearer ${auth.token}`);
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

export function buildHttpRequest(draft: HttpRequestDraft): HttpBuiltRequest {
  const method = (draft.method || 'GET').trim().toUpperCase();
  const url = draft.url.trim();
  if (!url) throw new Error('Request URL is required.');

  const query = enabledPairs(draft.query);
  const headerEntries: Array<[string, string]> = enabledPairs(draft.headers).map(({ key, value }) => [key, value]);
  applyAuth(draft, headerEntries, query);

  let body: string | undefined;
  let bodyKind: BuiltRequest['bodyKind'];
  let requestBody: BodyInit | undefined;
  if (draft.body && !['GET', 'HEAD'].includes(method)) {
    body = draft.body;
    requestBody = draft.body;
    const explicitContentType = findHeader(headerEntries, 'Content-Type');
    const requestedContentType = draft.contentType?.trim();
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

export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: Array<[string, string]> }): HttpRequestDraft {
  const entries = request.headerEntries || Object.entries(request.headers);
  return {
    method: request.method,
    url: request.url,
    headers: entries.map(([key, value]) => ({ key, value })),
    body: request.body,
    contentType: findHeader(entries, 'Content-Type'),
    auth: { type: 'none' },
  };
}
