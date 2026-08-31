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

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  const existing = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  if (existing && existing !== name) delete headers[existing];
  headers[name] = value;
}

function encodeBasicCredential(value: string): string {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(unescape(encodeURIComponent(value)));
  return value;
}

function applyAuth(draft: HttpRequestDraft, headers: Record<string, string>, query: HttpKeyValue[]): void {
  const auth = draft.auth;
  if (!auth || auth.type === 'none') return;
  if (auth.type === 'bearer') {
    if (auth.token) setHeader(headers, 'Authorization', `Bearer ${auth.token}`);
    return;
  }
  if (auth.type === 'basic') {
    if (auth.username || auth.password) setHeader(headers, 'Authorization', `Basic ${encodeBasicCredential(`${auth.username}:${auth.password}`)}`);
    return;
  }
  if (!auth.key) return;
  if (auth.in === 'query') query.push({ key: auth.key, value: auth.value });
  else setHeader(headers, auth.key, auth.value);
}

export function buildHttpRequest(draft: HttpRequestDraft): BuiltRequest {
  const method = (draft.method || 'GET').trim().toUpperCase();
  const url = draft.url.trim();
  if (!url) throw new Error('Request URL is required.');

  const query = enabledPairs(draft.query);
  const headers: Record<string, string> = {};
  for (const entry of enabledPairs(draft.headers)) setHeader(headers, entry.key, entry.value);
  applyAuth(draft, headers, query);

  let body: string | undefined;
  let bodyKind: BuiltRequest['bodyKind'];
  let requestBody: BodyInit | undefined;
  if (draft.body && !['GET', 'HEAD'].includes(method)) {
    body = draft.body;
    requestBody = draft.body;
    const explicitContentType = findHeader(headers, 'Content-Type');
    const requestedContentType = draft.contentType?.trim();
    if (!explicitContentType && requestedContentType) setHeader(headers, 'Content-Type', requestedContentType);
    const contentType = explicitContentType || requestedContentType;
    bodyKind = contentType?.includes('json') ? 'json' : contentType === 'application/x-www-form-urlencoded' ? 'form' : contentType?.startsWith('multipart/form-data') ? 'multipart' : 'text';
  }

  const resolvedUrl = appendQuery(url, query);
  return {
    url: resolvedUrl,
    method,
    headers,
    body,
    bodyKind,
    init: { method, headers, body: requestBody },
  };
}

export function requestDraftFromBuiltRequest(request: BuiltRequest): HttpRequestDraft {
  return {
    method: request.method,
    url: request.url,
    headers: Object.entries(request.headers).map(([key, value]) => ({ key, value })),
    body: request.body,
    contentType: findHeader(request.headers, 'Content-Type'),
    auth: { type: 'none' },
  };
}
