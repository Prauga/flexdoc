import type { BuiltRequest } from './request-builder.js';

/** One editable key/value row used by query, header, and form editors. */
export interface HttpKeyValue {
  /** Parameter/header/form field name. */ key: string;
  /** Parameter/header/form field value. */ value: string;
  /** Whether the row participates in request construction. Defaults to enabled. */ enabled?: boolean;
}

/** Body editor/serialization mode used by API Client. */
export type HttpBodyMode = 'none' | 'raw' | 'json' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';

/** One multipart/form-data field. */
export interface HttpFormDataEntry extends HttpKeyValue {
  /** Whether this row carries plain text or a file. */ type?: 'text' | 'file';
  /** Browser `File` selected for a file row. */ file?: File;
  /** File name sent to the server; defaults to the selected file name. */ fileName?: string;
  /** Optional content type for the file part. */ contentType?: string;
}

/** GraphQL request body editor state. */
export interface HttpGraphqlBody {
  /** GraphQL operation/query text. */ query: string;
  /** JSON text containing GraphQL variables. */ variables: string;
}

/** Binary request body editor state. */
export interface HttpBinaryBody {
  /** Browser `File` selected as the raw request body. */ file?: File;
  /** File name retained for persistence/history when the `File` itself is unavailable. */ fileName?: string;
  /** Content type advertised for the binary body. */ contentType?: string;
}

/** Capability that requires execution inside the backend host rather than normal browser Fetch. */
export type HttpHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';

/** Per-request API-host execution selections. */
export interface HttpHostExecutionSelection {
  /** Id of a server-side client certificate configured by the documentation host. */ certificateId?: string;
  /** Use FlexDoc's server-side session cookie jar for the request. */ cookieJar?: 'session';
}

/** HTTP Digest authentication credentials. */
export interface HttpDigestAuth {
  /** Authentication discriminator. */ type: 'digest';
  /** Digest username. */ username: string;
  /** Digest password. */ password: string;
}

/** Hawk authentication credentials and signing options. */
export interface HttpHawkAuth {
  /** Authentication discriminator. */ type: 'hawk';
  /** Hawk credential id. */ id: string;
  /** Hawk shared signing key. */ key: string;
  /** Hawk MAC algorithm. */ algorithm?: 'sha1' | 'sha256';
  /** Optional Hawk `ext` application data. */ ext?: string;
}

/** NTLM/Negotiate authentication credentials. */
export interface HttpNtlmAuth {
  /** Authentication discriminator. */ type: 'ntlm';
  /** NTLM username. */ username: string;
  /** NTLM password. */ password: string;
  /** Optional Windows/NTLM domain. */ domain?: string;
  /** Optional workstation name. */ workstation?: string;
}

/** OAuth 1.0a signing configuration. */
export interface HttpOAuth1Auth {
  /** Authentication discriminator. */ type: 'oauth1';
  /** OAuth consumer key. */ consumerKey: string;
  /** OAuth consumer secret. */ consumerSecret: string;
  /** Optional resource-owner/access token. */ token?: string;
  /** Optional token secret. */ tokenSecret?: string;
  /** OAuth 1 signature method. */ signatureMethod?: 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT';
  /** Optional Authorization-header realm. */ realm?: string;
}

/** AWS Signature Version 4 credentials and signing scope. */
export interface HttpAwsV4Auth {
  /** Authentication discriminator. */ type: 'awsv4';
  /** AWS access key id. */ accessKey: string;
  /** AWS secret access key. */ secretKey: string;
  /** Optional temporary session token. */ sessionToken?: string;
  /** AWS signing region. */ region: string;
  /** AWS service name used in the credential scope. */ service: string;
}

/** OAuth 2 flow represented by API Client. */
export type HttpOAuth2GrantType = 'accessToken' | 'authorizationCode' | 'clientCredentials' | 'password' | 'implicit';

/** OAuth 2 authentication configuration and optional token-acquisition metadata. */
export interface HttpOAuth2Auth {
  /** Authentication discriminator. */ type: 'oauth2';
  /** Bearer access token currently used for request execution. */ accessToken: string;
  /** OAuth flow used to acquire or describe the token. */ grantType?: HttpOAuth2GrantType;
  /** Authorization endpoint for authorization-code/implicit flows. */ authorizationUrl?: string;
  /** Token endpoint for code, client-credentials, password, or refresh flows. */ tokenUrl?: string;
  /** OAuth client id. */ clientId?: string;
  /** OAuth client secret. */ clientSecret?: string;
  /** How client credentials are sent to the token endpoint. */ clientAuthentication?: 'body' | 'basic';
  /** Redirect URI used by browser authorization flows. */ redirectUri?: string;
  /** Requested OAuth scopes. */ scopes?: string[];
  /** Resource-owner username for the password grant. */ username?: string;
  /** Resource-owner password for the password grant. */ password?: string;
  /** Refresh token retained for token renewal. */ refreshToken?: string;
}

/** Authentication mode attached to an arbitrary API Client request. */
export type HttpAuth =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'bearer'; token: string }
  | HttpOAuth2Auth
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; in: 'header' | 'query' | 'cookie' }
  | HttpDigestAuth
  | HttpHawkAuth
  | HttpNtlmAuth
  | HttpOAuth1Auth
  | HttpAwsV4Auth;

/** Editable HTTP request draft used by API Client and host execution. */
export interface HttpRequestDraft {
  /** HTTP method entered by the user. */ method: string;
  /** Request URL before variable substitution and query-row appending. */ url: string;
  /** Ordered query-string rows. */ query?: HttpKeyValue[];
  /** Ordered request-header rows; duplicate names are preserved by `HttpBuiltRequest`. */ headers?: HttpKeyValue[];
  /** Raw/JSON body text for text-oriented body modes. */ body?: string;
  /** Requested Content-Type for applicable body modes. */ contentType?: string;
  /** Active body editor/serialization mode. */ bodyMode?: HttpBodyMode;
  /** Form fields used for `application/x-www-form-urlencoded`. */ urlencoded?: HttpKeyValue[];
  /** Multipart/form-data fields. */ formData?: HttpFormDataEntry[];
  /** Binary body selection. */ binary?: HttpBinaryBody;
  /** GraphQL query and variables. */ graphql?: HttpGraphqlBody;
  /** Authentication applied when the request is built/executed. */ auth?: HttpAuth;
  /** Server-side execution selections such as cookie jar or client certificate. */ hostExecution?: HttpHostExecutionSelection;
}

/** Named `{{variable}}` values available during request resolution. */
export type HttpVariables = Record<string, string>;

/** Options controlling arbitrary HTTP request construction. */
export interface HttpRequestBuildOptions {
  /** Values substituted into `{{variable}}` placeholders before request construction. */ variables?: HttpVariables;
}

/**
 * Arbitrary HTTP requests retain their ordered header entries in addition to
 * the legacy record view exposed by BuiltRequest. The ordered entries are the
 * canonical representation for execution because a record cannot represent
 * duplicate header names.
 */
export interface HttpBuiltRequest extends BuiltRequest {
  /** Canonical ordered header list used for execution so duplicate names survive. */
  headerEntries: Array<[string, string]>;
}

function enabledPairs(entries: HttpKeyValue[] | undefined): HttpKeyValue[] {
  return (entries || []).filter((entry) => entry.enabled !== false && entry.key.trim() !== '');
}

/**
 * Infer the body editor mode from draft fields.
 * @param draft Partial request draft to inspect.
 * @returns Explicit body mode when set, otherwise a mode inferred from populated body fields/content type.
 */
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

/**
 * Return host-execution capabilities required by the draft.
 * @param draft Request draft to inspect for browser-incompatible auth/cookie/certificate needs.
 * @returns Deduplicated required capability identifiers.
 */
export function httpHostExecutionRequirements(draft: Partial<HttpRequestDraft>): HttpHostExecutionCapability[] {
  const requirements = new Set<HttpHostExecutionCapability>();
  const auth = draft.auth;
  if (auth?.type === 'apiKey' && auth.in === 'cookie') requirements.add('cookies');
  else if (auth?.type === 'digest') requirements.add('digest');
  else if (auth?.type === 'hawk') requirements.add('hawk');
  else if (auth?.type === 'ntlm') requirements.add('ntlm');
  else if (auth?.type === 'oauth1') requirements.add('oauth1');
  else if (auth?.type === 'awsv4') requirements.add('awsv4');
  if (draft.headers?.some((entry) => entry.enabled !== false && entry.key.trim().toLowerCase() === 'cookie')) requirements.add('cookies');
  if (draft.hostExecution?.cookieJar === 'session') requirements.add('cookies');
  if (draft.hostExecution?.certificateId) requirements.add('clientCertificates');
  return [...requirements];
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
  if (auth.type === 'apiKey') return {
    type: 'apiKey',
    key: resolveTemplateValue(auth.key, variables) || '',
    value: resolveTemplateValue(auth.value, variables) || '',
    in: auth.in,
  };
  if (auth.type === 'digest') return { type: 'digest', username: resolveTemplateValue(auth.username, variables) || '', password: resolveTemplateValue(auth.password, variables) || '' };
  if (auth.type === 'hawk') return { ...auth, id: resolveTemplateValue(auth.id, variables) || '', key: resolveTemplateValue(auth.key, variables) || '', ext: resolveTemplateValue(auth.ext, variables) };
  if (auth.type === 'ntlm') return {
    ...auth,
    username: resolveTemplateValue(auth.username, variables) || '',
    password: resolveTemplateValue(auth.password, variables) || '',
    domain: resolveTemplateValue(auth.domain, variables),
    workstation: resolveTemplateValue(auth.workstation, variables),
  };
  if (auth.type === 'oauth1') return {
    ...auth,
    consumerKey: resolveTemplateValue(auth.consumerKey, variables) || '',
    consumerSecret: resolveTemplateValue(auth.consumerSecret, variables) || '',
    token: resolveTemplateValue(auth.token, variables),
    tokenSecret: resolveTemplateValue(auth.tokenSecret, variables),
    realm: resolveTemplateValue(auth.realm, variables),
  };
  return {
    ...auth,
    accessKey: resolveTemplateValue(auth.accessKey, variables) || '',
    secretKey: resolveTemplateValue(auth.secretKey, variables) || '',
    sessionToken: resolveTemplateValue(auth.sessionToken, variables),
    region: resolveTemplateValue(auth.region, variables) || '',
    service: resolveTemplateValue(auth.service, variables) || '',
  };
}

/**
 * Resolve variables in a draft without mutating the input.
 * @param draft Source request draft.
 * @param variables Values substituted into `{{name}}` placeholders throughout request/auth fields.
 * @returns Cloned request draft containing resolved values.
 */
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
    hostExecution: draft.hostExecution ? { ...draft.hostExecution } : undefined,
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
  if (auth.type !== 'apiKey' || !auth.key) return;
  if (auth.in === 'query') query.push({ key: auth.key, value: auth.value });
  else if (auth.in === 'header') replaceHeader(headers, auth.key, auth.value);
}

/**
 * Build a transport request from an arbitrary HTTP draft, resolving `{{variable}}` placeholders.
 * @param draft Editable request draft.
 * @param options Variable-resolution options.
 * @returns Fetch-ready request with ordered header entries.
 * @throws When the URL is empty or the draft requires API-host execution.
 */
export function buildHttpRequest(draft: HttpRequestDraft, options: HttpRequestBuildOptions = {}): HttpBuiltRequest {
  const resolvedDraft = options.variables ? resolveHttpRequestDraftVariables(draft, options.variables) : draft;
  const method = (resolvedDraft.method || 'GET').trim().toUpperCase();
  const url = resolvedDraft.url.trim();
  if (!url) throw new Error('Request URL is required.');

  const requirements = httpHostExecutionRequirements(resolvedDraft);
  if (requirements.length > 0) throw new Error(`This request requires API host execution (${requirements.join(', ')}).`);
  const query = enabledPairs(resolvedDraft.query);
  const headerEntries: Array<[string, string]> = enabledPairs(resolvedDraft.headers).map(({ key, value }) => [key, value]);
  applyAuth(resolvedDraft, headerEntries, query);

  let body: string | undefined;
  let bodyKind: BuiltRequest['bodyKind'];
  let requestBody: BodyInit | undefined;
  const bodyMode = inferHttpBodyMode(resolvedDraft);
  if (bodyMode !== 'none') {
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

/**
 * Convert a built request into an editable API Client draft.
 * @param request Canonical built request, optionally retaining ordered header entries.
 * @returns Editable draft with URL query parameters and body mode reconstructed where possible.
 */
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
