import * as crypto from 'crypto';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { getPublicSuffix } from 'tldts';
import type {
  FlexDocHostExecutionCapability,
  FlexDocHostExecutionOptions,
  FlexDocHostExecutionPublicOptions,
  FlexDocHostExecutionRequest,
} from './interfaces';

type HeaderEntry = [string, string];
type HostAuth =
  | { type?: 'none' | 'inherit' }
  | { type: 'bearer'; token?: string }
  | { type: 'oauth2'; accessToken?: string }
  | { type: 'basic'; username?: string; password?: string }
  | { type: 'apiKey'; key?: string; value?: string; in?: 'header' | 'query' | 'cookie' }
  | { type: 'digest'; username?: string; password?: string }
  | { type: 'hawk'; id?: string; key?: string; algorithm?: 'sha1' | 'sha256'; ext?: string }
  | { type: 'ntlm'; username?: string; password?: string; domain?: string; workstation?: string }
  | { type: 'oauth1'; consumerKey?: string; consumerSecret?: string; token?: string; tokenSecret?: string; signatureMethod?: 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT'; realm?: string }
  | { type: 'awsv4'; accessKey?: string; secretKey?: string; sessionToken?: string; region?: string; service?: string };

export interface HostExecutionRequestDraft {
  method?: string;
  url?: string;
  query?: Array<{ key?: string; value?: string; enabled?: boolean }>;
  headers?: Array<{ key?: string; value?: string; enabled?: boolean }>;
  body?: string;
  contentType?: string;
  bodyMode?: 'none' | 'raw' | 'json' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';
  urlencoded?: Array<{ key?: string; value?: string; enabled?: boolean }>;
  formData?: Array<{ key?: string; value?: string; enabled?: boolean; type?: 'text' | 'file'; fileName?: string; contentType?: string }>;
  binary?: { fileName?: string; contentType?: string };
  graphql?: { query?: string; variables?: string };
  auth?: HostAuth;
}

export interface HostExecutionEnvelope {
  request: HostExecutionRequestDraft;
  certificateId?: string;
  cookieJar?: 'session';
  timeoutMs?: number;
  bodyBase64?: string;
}

export interface HostExecutionUploadedFile {
  name: string;
  contentType?: string;
  data: Buffer;
}

export interface ParsedHostExecutionEnvelope extends HostExecutionEnvelope {
  formDataFiles?: Map<number, HostExecutionUploadedFile>;
}

export interface HostExecutionResponse {
  status: number;
  statusText: string;
  headers: HeaderEntry[];
  body: string;
  responseTime: number;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string; httpOnly?: boolean }>;
  error?: string;
}

interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  secure: boolean;
  httpOnly: boolean;
  expiresAt?: number;
}

export class HostExecutionForbiddenError extends Error {}
export class HostExecutionUnsupportedError extends Error {}
export class HostExecutionBadRequestError extends Error {}

export interface HostExecutionState {
  enabled: boolean;
  options: FlexDocHostExecutionOptions;
  capabilities: FlexDocHostExecutionCapability[];
  certificates: Map<string, { id: string; name: string; cert: string; key: string; passphrase?: string }>;
  sessionSecret: Buffer;
  jars: Map<string, CookieRecord[]>;
}

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'set-cookie']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_SESSION_JARS = 1000;
const SESSION_COOKIE = '__flexdoc_session';

/** Create host-execution state from Try It host-execution options. */
export function createHostExecutionState(value: boolean | FlexDocHostExecutionOptions | undefined): HostExecutionState {
  const enabled = value === true || (typeof value === 'object' && value !== null && value.enabled !== false);
  const options = typeof value === 'object' ? value : {};
  const certificates = new Map((options.clientCertificates || []).map((certificate) => [certificate.id, { ...certificate }]));
  const capabilities: FlexDocHostExecutionCapability[] = enabled
    ? ['cookies', 'digest', 'hawk', 'oauth1', 'awsv4', ...(certificates.size ? ['clientCertificates' as const] : [])]
    : [];
  return {
    enabled,
    options,
    capabilities,
    certificates,
    sessionSecret: crypto.randomBytes(32),
    jars: new Map(),
  };
}

/** Public host-execution metadata serialized to the browser renderer. */
export function publicHostExecutionOptions(state: HostExecutionState, rendererBasePath: string): FlexDocHostExecutionPublicOptions | undefined {
  if (!state.enabled) return undefined;
  return {
    available: true,
    endpoint: `${rendererBasePath}/execute`,
    cookiesEndpoint: `${rendererBasePath}/cookies`,
    capabilities: [...state.capabilities],
    ...(state.certificates.size ? { clientCertificates: [...state.certificates.values()].map(({ id, name }) => ({ id, name })) } : {}),
  };
}

function base64Url(input: Buffer): string {
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signSession(state: HostExecutionState, id: string): string {
  return base64Url(crypto.createHmac('sha256', state.sessionSecret).update(id).digest());
}

function parseCookieHeader(value: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (value || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    out.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return out;
}

function allocateSessionJar(state: HostExecutionState, id: string): void {
  while (state.jars.size >= MAX_SESSION_JARS) {
    const oldest = state.jars.keys().next().value as string | undefined;
    if (!oldest) break;
    state.jars.delete(oldest);
  }
  state.jars.set(id, []);
}

export function ensureHostExecutionSession(state: HostExecutionState, cookieHeader?: string): { sessionId: string; setCookie?: string } {
  const raw = parseCookieHeader(cookieHeader).get(SESSION_COOKIE);
  if (raw) {
    const separator = raw.lastIndexOf('.');
    if (separator > 0) {
      const id = raw.slice(0, separator);
      const signature = raw.slice(separator + 1);
      const expected = signSession(state, id);
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        if (!state.jars.has(id)) allocateSessionJar(state, id);
        return { sessionId: id };
      }
    }
  }
  const sessionId = base64Url(crypto.randomBytes(24));
  const signed = `${sessionId}.${signSession(state, sessionId)}`;
  allocateSessionJar(state, sessionId);
  return {
    sessionId,
    setCookie: `${SESSION_COOKIE}=${signed}; Path=/; HttpOnly; SameSite=Strict`,
  };
}

function cleanExpired(cookies: CookieRecord[]): CookieRecord[] {
  const now = Date.now();
  return cookies.filter((cookie) => cookie.expiresAt === undefined || cookie.expiresAt > now);
}

function domainMatches(hostname: string, cookie: CookieRecord): boolean {
  const host = hostname.toLowerCase();
  const domain = cookie.domain.toLowerCase().replace(/^\./, '');
  return cookie.hostOnly ? host === domain : host === domain || host.endsWith(`.${domain}`);
}

export function isCookieDomainAllowed(responseHostname: string, candidateDomain: string): boolean {
  const responseHost = responseHostname.toLowerCase().replace(/^\[|\]$/g, '');
  const domain = candidateDomain.toLowerCase().replace(/^\./, '');
  if (!domain || domain.endsWith('.') || net.isIP(responseHost) || net.isIP(domain)) return false;
  if (responseHost !== domain && !responseHost.endsWith(`.${domain}`)) return false;
  const publicSuffix = getPublicSuffix(domain, { allowPrivateDomains: true, extractHostname: false });
  return !publicSuffix || publicSuffix.toLowerCase() !== domain;
}

function cookiesForUrl(state: HostExecutionState, sessionId: string, url: URL): CookieRecord[] {
  const existing = cleanExpired(state.jars.get(sessionId) || []);
  state.jars.set(sessionId, existing);
  return existing.filter((cookie) => domainMatches(url.hostname, cookie) && url.pathname.startsWith(cookie.path) && (!cookie.secure || url.protocol === 'https:'));
}

function parseSetCookie(value: string, url: URL): CookieRecord | undefined {
  const parts = value.split(';').map((part) => part.trim());
  const pair = parts.shift();
  if (!pair) return undefined;
  const equals = pair.indexOf('=');
  if (equals <= 0) return undefined;
  const cookie: CookieRecord = {
    name: pair.slice(0, equals),
    value: pair.slice(equals + 1),
    domain: url.hostname,
    path: '/',
    hostOnly: true,
    secure: false,
    httpOnly: false,
  };
  for (const attribute of parts) {
    const index = attribute.indexOf('=');
    const key = (index < 0 ? attribute : attribute.slice(0, index)).trim().toLowerCase();
    const raw = index < 0 ? '' : attribute.slice(index + 1).trim();
    if (key === 'domain' && raw) {
      const domain = raw.replace(/^\./, '').toLowerCase();
      if (!isCookieDomainAllowed(url.hostname, domain)) return undefined;
      cookie.domain = domain;
      cookie.hostOnly = false;
    }
    else if (key === 'path' && raw) cookie.path = raw.startsWith('/') ? raw : '/';
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'max-age' && /^-?\d+$/.test(raw)) cookie.expiresAt = Date.now() + Number(raw) * 1000;
    else if (key === 'expires') {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) cookie.expiresAt = parsed;
    }
  }
  return cookie;
}

function storeSetCookies(state: HostExecutionState, sessionId: string, url: URL, values: string[]): void {
  let jar = cleanExpired(state.jars.get(sessionId) || []);
  for (const value of values) {
    const cookie = parseSetCookie(value, url);
    if (!cookie) continue;
    jar = jar.filter((existing) => !(existing.name === cookie.name && existing.domain === cookie.domain && existing.path === cookie.path));
    if (cookie.expiresAt === undefined || cookie.expiresAt > Date.now()) jar.push(cookie);
  }
  if (jar.length > 100) jar = jar.slice(jar.length - 100);
  state.jars.set(sessionId, jar);
}

export function publicCookiesForSession(state: HostExecutionState, sessionId: string): HostExecutionResponse['cookies'] {
  const jar = cleanExpired(state.jars.get(sessionId) || []);
  state.jars.set(sessionId, jar);
  return jar.map((cookie) => ({ name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path, httpOnly: cookie.httpOnly }));
}

export function clearCookiesForSession(state: HostExecutionState, sessionId: string): void {
  state.jars.set(sessionId, []);
}

function normalizeServerUrl(server: any): string | undefined {
  if (!server || typeof server.url !== 'string') return undefined;
  let value = server.url;
  const variables = server.variables && typeof server.variables === 'object' ? server.variables : {};
  value = value.replace(/\{([^{}]+)\}/g, (match: string, name: string) => {
    const candidate = variables[name];
    return candidate && typeof candidate.default !== 'undefined' ? String(candidate.default) : match;
  });
  return value;
}

function collectOpenApiServerUrls(spec: any): string[] {
  const values: string[] = [];
  const addServers = (servers: any) => {
    if (!Array.isArray(servers)) return;
    for (const server of servers) {
      const value = normalizeServerUrl(server);
      if (value) values.push(value);
    }
  };
  addServers(spec?.servers);
  if (spec?.paths && typeof spec.paths === 'object') {
    for (const pathItem of Object.values<any>(spec.paths)) {
      addServers(pathItem?.servers);
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']) addServers(pathItem?.[method]?.servers);
    }
  }
  return values;
}

function normalizedOrigin(value: string, base?: string): string | undefined {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch { return undefined; }
}

export function allowedHostExecutionOrigins(state: HostExecutionState, spec: any, docsOrigin?: string): Set<string> {
  const configured = state.options.allowedOrigins?.filter(Boolean);
  const result = new Set<string>();
  if (configured?.length) {
    for (const value of configured) {
      const origin = normalizedOrigin(value);
      if (origin) result.add(origin);
    }
    return result;
  }

  const servers = collectOpenApiServerUrls(spec);
  const values = servers.length ? servers : ['/'];
  for (const value of values) {
    const origin = normalizedOrigin(value, docsOrigin);
    if (origin) result.add(origin);
  }
  return result;
}

function isMetadataAddress(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (value === '169.254.169.254' || value === 'metadata.google.internal' || value === 'metadata.google') return true;
  if (value.startsWith('::ffff:') && net.isIPv4(value.slice(7))) return isMetadataAddress(value.slice(7));
  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    return a === 169 && b === 254;
  }
  return value === 'fe80::a9fe:a9fe' || value.startsWith('fe80:');
}

export function assertHostExecutionUrlAllowed(url: URL, allowedOrigins: Set<string>): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HostExecutionForbiddenError(`Host execution only allows HTTP(S) URLs.`);
  if (url.username || url.password) throw new HostExecutionForbiddenError('Host execution URLs cannot contain embedded credentials.');
  if (isMetadataAddress(url.hostname)) throw new HostExecutionForbiddenError('Host execution blocks link-local and cloud metadata endpoints.');
  if (!allowedOrigins.has(url.origin)) throw new HostExecutionForbiddenError(`Origin ${url.origin} is not allowed for host execution.`);
}

export function assertHostExecutionResolvedAddressAllowed(address: string): void {
  if (isMetadataAddress(address)) throw new HostExecutionForbiddenError('Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.');
}

function enabledEntries(entries: HostExecutionRequestDraft['headers'] | HostExecutionRequestDraft['query']): Array<{ key: string; value: string }> {
  return (entries || []).flatMap((entry) => entry.enabled === false || !String(entry.key || '').trim() ? [] : [{ key: String(entry.key || ''), value: String(entry.value || '') }]);
}

function setHeader(headers: HeaderEntry[], name: string, value: string): void {
  for (let index = headers.length - 1; index >= 0; index -= 1) if (headers[index][0].toLowerCase() === name.toLowerCase()) headers.splice(index, 1);
  headers.push([name, value]);
}

function getHeader(headers: HeaderEntry[], name: string): string | undefined {
  return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function deleteHeader(headers: HeaderEntry[], name: string): void {
  for (let index = headers.length - 1; index >= 0; index -= 1) if (headers[index][0].toLowerCase() === name.toLowerCase()) headers.splice(index, 1);
}

function sanitizeHeaders(entries: HostExecutionRequestDraft['headers']): HeaderEntry[] {
  return enabledEntries(entries).flatMap(({ key, value }) => {
    const normalized = key.trim().toLowerCase();
    if (HOP_BY_HOP.has(normalized) || normalized.startsWith('proxy-') || normalized.startsWith('sec-') || normalized === 'origin' || normalized === 'referer') return [];
    return [[key.trim(), value] as HeaderEntry];
  });
}

function appendQuery(url: URL, entries: Array<{ key: string; value: string }>): void {
  for (const entry of entries) url.searchParams.append(entry.key, entry.value);
}

function inferBodyMode(draft: HostExecutionRequestDraft): NonNullable<HostExecutionRequestDraft['bodyMode']> {
  if (draft.bodyMode) return draft.bodyMode;
  if (draft.binary?.fileName) return 'binary';
  if (draft.formData?.length) return 'formdata';
  if (draft.urlencoded?.length) return 'urlencoded';
  if (draft.graphql && (draft.graphql.query || draft.graphql.variables)) return 'graphql';
  if (!draft.body) return 'none';
  return (draft.contentType || '').toLowerCase().includes('json') ? 'json' : 'raw';
}

function quoteMultipart(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
}

function multipartBody(draft: HostExecutionRequestDraft, files: Map<number, HostExecutionUploadedFile> | undefined): { body: Buffer; contentType: string } {
  const boundary = `----flexdoc-${crypto.randomBytes(12).toString('hex')}`;
  const chunks: Buffer[] = [];
  const push = (value: string | Buffer) => chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'));
  (draft.formData || []).forEach((entry, index) => {
    if (entry.enabled === false || !String(entry.key || '').trim()) return;
    const key = quoteMultipart(String(entry.key));
    push(`--${boundary}\r\n`);
    if (entry.type === 'file') {
      const file = files?.get(index);
      if (!file) throw new HostExecutionBadRequestError(`File field "${entry.key}" needs an uploaded file part.`);
      push(`Content-Disposition: form-data; name="${key}"; filename="${quoteMultipart(file.name || entry.fileName || 'upload.bin')}"\r\n`);
      push(`Content-Type: ${file.contentType || entry.contentType || 'application/octet-stream'}\r\n\r\n`);
      push(file.data);
      push('\r\n');
    } else {
      push(`Content-Disposition: form-data; name="${key}"\r\n\r\n${String(entry.value || '')}\r\n`);
    }
  });
  push(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function prepareBody(draft: HostExecutionRequestDraft, envelope: ParsedHostExecutionEnvelope): { body?: Buffer; contentType?: string } {
  const mode = inferBodyMode(draft);
  if (mode === 'none') return {};
  if (mode === 'binary') {
    if (!envelope.bodyBase64) throw new HostExecutionBadRequestError('Binary host execution requires bodyBase64.');
    return { body: Buffer.from(envelope.bodyBase64, 'base64'), contentType: draft.contentType || draft.binary?.contentType || 'application/octet-stream' };
  }
  if (mode === 'formdata') return multipartBody(draft, envelope.formDataFiles);
  if (mode === 'urlencoded') {
    const body = new URLSearchParams(enabledEntries(draft.urlencoded).map(({ key, value }) => [key, value])).toString();
    return { body: Buffer.from(body), contentType: draft.contentType || 'application/x-www-form-urlencoded' };
  }
  if (mode === 'graphql') {
    let variables: unknown = {};
    const raw = String(draft.graphql?.variables || '').trim();
    if (raw) {
      try { variables = JSON.parse(raw); } catch { throw new HostExecutionBadRequestError('GraphQL variables must be valid JSON.'); }
    }
    return { body: Buffer.from(JSON.stringify({ query: draft.graphql?.query || '', variables })), contentType: draft.contentType || 'application/json' };
  }
  return { body: Buffer.from(String(draft.body || ''), 'utf8'), contentType: draft.contentType || (mode === 'json' ? 'application/json' : undefined) };
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauth1Header(auth: Extract<HostAuth, { type: 'oauth1' }>, method: string, url: URL, headers: HeaderEntry[], body: Buffer | undefined): string {
  const signatureMethod = auth.signatureMethod || 'HMAC-SHA1';
  const oauth: Record<string, string> = {
    oauth_consumer_key: auth.consumerKey || '',
    oauth_nonce: base64Url(crypto.randomBytes(18)),
    oauth_signature_method: signatureMethod,
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  };
  if (auth.token) oauth.oauth_token = auth.token;
  const params: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => params.push([key, value]));
  for (const [key, value] of Object.entries(oauth)) params.push([key, value]);
  const contentType = (getHeader(headers, 'Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (contentType === 'application/x-www-form-urlencoded' && body) new URLSearchParams(body.toString('utf8')).forEach((value, key) => params.push([key, value]));
  params.sort((a, b) => percentEncode(a[0]).localeCompare(percentEncode(b[0])) || percentEncode(a[1]).localeCompare(percentEncode(b[1])));
  const normalized = params.map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`).join('&');
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const baseString = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(normalized)].join('&');
  const signingKey = `${percentEncode(auth.consumerSecret || '')}&${percentEncode(auth.tokenSecret || '')}`;
  oauth.oauth_signature = signatureMethod === 'PLAINTEXT'
    ? signingKey
    : crypto.createHmac(signatureMethod === 'HMAC-SHA256' ? 'sha256' : 'sha1', signingKey).update(baseString).digest('base64');
  const fields = Object.entries(oauth).map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`);
  if (auth.realm) fields.unshift(`realm="${percentEncode(auth.realm)}"`);
  return `OAuth ${fields.join(', ')}`;
}

function hawkHeader(auth: Extract<HostAuth, { type: 'hawk' }>, method: string, url: URL): string {
  const algorithm = auth.algorithm || 'sha256';
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = base64Url(crypto.randomBytes(8));
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const ext = auth.ext || '';
  const normalized = `hawk.1.header\n${ts}\n${nonce}\n${method.toUpperCase()}\n${url.pathname}${url.search}\n${url.hostname.toLowerCase()}\n${port}\n\n${ext}\n\n\n`;
  const mac = crypto.createHmac(algorithm, auth.key || '').update(normalized).digest('base64');
  return `Hawk id="${String(auth.id || '').replace(/"/g, '\\"')}", ts="${ts}", nonce="${nonce}", mac="${mac}"${ext ? `, ext="${ext.replace(/"/g, '\\"')}"` : ''}`;
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function awsV4Headers(auth: Extract<HostAuth, { type: 'awsv4' }>, method: string, url: URL, headers: HeaderEntry[], body: Buffer | undefined): void {
  if (!auth.accessKey || !auth.secretKey || !auth.region || !auth.service) throw new HostExecutionBadRequestError('AWS Signature V4 requires access key, secret key, region, and service.');
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body || Buffer.alloc(0));
  setHeader(headers, 'Host', url.host);
  setHeader(headers, 'X-Amz-Date', amzDate);
  setHeader(headers, 'X-Amz-Content-Sha256', payloadHash);
  if (auth.sessionToken) setHeader(headers, 'X-Amz-Security-Token', auth.sessionToken);
  const canonicalHeaders = [...headers]
    .map(([key, value]) => [key.trim().toLowerCase(), value.trim().replace(/\s+/g, ' ')] as HeaderEntry)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const deduped = new Map<string, string>();
  for (const [key, value] of canonicalHeaders) deduped.set(key, deduped.has(key) ? `${deduped.get(key)},${value}` : value);
  const signedHeaders = [...deduped.keys()].join(';');
  const canonicalHeaderText = [...deduped.entries()].map(([key, value]) => `${key}:${value}\n`).join('');
  const canonicalQuery = [...url.searchParams.entries()]
    .map(([key, value]) => [percentEncode(key), percentEncode(value)] as HeaderEntry)
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    .map(([key, value]) => `${key}=${value}`).join('&');
  const canonicalUri = url.pathname.split('/').map((part) => percentEncode(decodeURIComponent(part))).join('/') || '/';
  const canonicalRequest = `${method.toUpperCase()}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaderText}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${auth.region}/${auth.service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest();
  const dateKey = hmac(`AWS4${auth.secretKey}`, date);
  const regionKey = hmac(dateKey, auth.region);
  const serviceKey = hmac(regionKey, auth.service);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  setHeader(headers, 'Authorization', `AWS4-HMAC-SHA256 Credential=${auth.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
  deleteHeader(headers, 'Host');
}

function parseDigestChallenge(value: string): Record<string, string> {
  if (!/^\s*Digest\s+/i.test(value)) throw new HostExecutionUnsupportedError('Server did not return a Digest challenge.');
  const result: Record<string, string> = {};
  const raw = value.replace(/^\s*Digest\s+/i, '');
  const pattern = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
  return result;
}

function digestHeader(auth: Extract<HostAuth, { type: 'digest' }>, challengeValue: string, method: string, url: URL): string {
  const challenge = parseDigestChallenge(challengeValue);
  const realm = challenge.realm || '';
  const nonce = challenge.nonce;
  if (!nonce) throw new HostExecutionUnsupportedError('Digest challenge is missing a nonce.');
  const algorithmRaw = (challenge.algorithm || 'MD5').toUpperCase();
  const session = algorithmRaw.endsWith('-SESS');
  const algorithm = algorithmRaw.replace(/-SESS$/, '');
  const hashName = algorithm === 'SHA-256' ? 'sha256' : algorithm === 'MD5' ? 'md5' : undefined;
  if (!hashName) throw new HostExecutionUnsupportedError(`Digest algorithm ${algorithmRaw} is not supported.`);
  const hash = (value: string) => crypto.createHash(hashName).update(value).digest('hex');
  const username = auth.username || '';
  const password = auth.password || '';
  const uri = `${url.pathname}${url.search}` || '/';
  const cnonce = crypto.randomBytes(12).toString('hex');
  const nc = '00000001';
  const qopValues = (challenge.qop || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const qop = qopValues.includes('auth') ? 'auth' : qopValues[0];
  if (qop && qop !== 'auth') throw new HostExecutionUnsupportedError(`Digest qop ${qop} is not supported.`);
  let ha1 = hash(`${username}:${realm}:${password}`);
  if (session) ha1 = hash(`${ha1}:${nonce}:${cnonce}`);
  const ha2 = hash(`${method.toUpperCase()}:${uri}`);
  const response = qop ? hash(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : hash(`${ha1}:${nonce}:${ha2}`);
  const parts = [
    `username="${username.replace(/"/g, '\\"')}"`,
    `realm="${realm.replace(/"/g, '\\"')}"`,
    `nonce="${nonce.replace(/"/g, '\\"')}"`,
    `uri="${uri.replace(/"/g, '\\"')}"`,
    `response="${response}"`,
  ];
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`);
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque.replace(/"/g, '\\"')}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

function headersForNode(entries: HeaderEntry[]): http.OutgoingHttpHeaders {
  const result: http.OutgoingHttpHeaders = {};
  for (const [key, value] of entries) {
    const existing = result[key];
    if (existing === undefined) result[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[key] = [String(existing), value];
  }
  return result;
}

interface RawResponse { status: number; statusText: string; headers: HeaderEntry[]; body: Buffer; setCookies: string[]; location?: string; }

const safeLookup = ((hostname: string, options: any, callback: any) => {
  dns.lookup(hostname, options, (error: NodeJS.ErrnoException | null, address: any, family?: number) => {
    if (error) return callback(error, address, family);
    try {
      const addresses = Array.isArray(address) ? address.map((entry) => entry.address) : [address];
      for (const resolved of addresses) assertHostExecutionResolvedAddressAllowed(String(resolved));
    } catch (lookupError) {
      return callback(lookupError);
    }
    return callback(null, address, family);
  });
}) as typeof dns.lookup;

function requestOnce(url: URL, method: string, headers: HeaderEntry[], body: Buffer | undefined, timeoutMs: number, agent?: https.Agent): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const started = Date.now();
    const request = client.request(url, {
      method,
      headers: headersForNode(headers),
      lookup: safeLookup,
      ...(url.protocol === 'https:' && agent ? { agent } : {}),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk) => {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('Host response exceeded the 10 MiB safety limit.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => {
        const rawHeaders: HeaderEntry[] = [];
        for (let index = 0; index < response.rawHeaders.length; index += 2) rawHeaders.push([response.rawHeaders[index], response.rawHeaders[index + 1] || '']);
        resolve({
          status: response.statusCode || 0,
          statusText: response.statusMessage || '',
          headers: rawHeaders,
          body: Buffer.concat(chunks),
          setCookies: response.headers['set-cookie'] || [],
          location: response.headers.location,
        });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Host request timed out after ${timeoutMs} ms.`)));
    if (body) request.write(body);
    request.end();
    void started;
  });
}

function responseHeader(headers: HeaderEntry[], name: string): string | undefined {
  return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function applyCookieHeader(headers: HeaderEntry[], jarCookies: CookieRecord[], explicitCookieHeader: string | undefined, apiKeyCookie?: { key: string; value: string }): void {
  const values = new Map<string, string>();
  for (const cookie of jarCookies) values.set(cookie.name, cookie.value);
  for (const [key, value] of parseCookieHeader(explicitCookieHeader)) values.set(key, value);
  if (apiKeyCookie?.key) values.set(apiKeyCookie.key, apiKeyCookie.value);
  deleteHeader(headers, 'Cookie');
  if (values.size) setHeader(headers, 'Cookie', [...values.entries()].map(([key, value]) => `${key}=${value}`).join('; '));
}

function applySimpleAuth(auth: HostAuth | undefined, url: URL, headers: HeaderEntry[]): { apiKeyCookie?: { key: string; value: string } } {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return {};
  if (auth.type === 'bearer' && auth.token) setHeader(headers, 'Authorization', `Bearer ${auth.token}`);
  else if (auth.type === 'oauth2' && auth.accessToken) setHeader(headers, 'Authorization', `Bearer ${auth.accessToken}`);
  else if (auth.type === 'basic') setHeader(headers, 'Authorization', `Basic ${Buffer.from(`${auth.username || ''}:${auth.password || ''}`, 'utf8').toString('base64')}`);
  else if (auth.type === 'apiKey' && auth.key) {
    if (auth.in === 'query') url.searchParams.append(auth.key, auth.value || '');
    else if (auth.in === 'header') setHeader(headers, auth.key, auth.value || '');
    else return { apiKeyCookie: { key: auth.key, value: auth.value || '' } };
  }
  return {};
}

function applyAdvancedAuth(auth: HostAuth | undefined, method: string, url: URL, headers: HeaderEntry[], body: Buffer | undefined): void {
  if (!auth) return;
  if (auth.type === 'hawk') setHeader(headers, 'Authorization', hawkHeader(auth, method, url));
  else if (auth.type === 'oauth1') setHeader(headers, 'Authorization', oauth1Header(auth, method, url, headers, body));
  else if (auth.type === 'awsv4') awsV4Headers(auth, method, url, headers, body);
  else if (auth.type === 'ntlm') throw new HostExecutionUnsupportedError('NTLM/Negotiate host execution is not implemented by the Node adapter.');
}

async function sendPrepared(
  state: HostExecutionState,
  envelope: ParsedHostExecutionEnvelope,
  spec: any,
  sessionId: string,
  docsOrigin: string | undefined,
): Promise<HostExecutionResponse> {
  const draft = envelope.request || {};
  const method = String(draft.method || 'GET').trim().toUpperCase();
  if (!METHODS.has(method)) throw new HostExecutionBadRequestError(`Unsupported HTTP method ${method}.`);
  if (!draft.url) throw new HostExecutionBadRequestError('Request URL is required.');
  const initialUrl = new URL(String(draft.url));
  appendQuery(initialUrl, enabledEntries(draft.query));
  const allowedOrigins = allowedHostExecutionOrigins(state, spec, docsOrigin);
  const preparedBody = prepareBody(draft, envelope);
  const timeoutMs = Math.min(Math.max(Number(envelope.timeoutMs || 30_000), 100), 120_000);
  const certificate = envelope.certificateId ? state.certificates.get(envelope.certificateId) : undefined;
  if (envelope.certificateId && !certificate) throw new HostExecutionBadRequestError('Unknown client certificate id.');
  const agent = certificate ? new https.Agent({ cert: certificate.cert, key: certificate.key, passphrase: certificate.passphrase }) : undefined;

  const executeAt = async (target: URL, nextMethod: string, redirectCount: number): Promise<HostExecutionResponse> => {
    assertHostExecutionUrlAllowed(target, allowedOrigins);
    const headers = sanitizeHeaders(draft.headers);
    if (preparedBody.contentType && inferBodyMode(draft) === 'formdata') deleteHeader(headers, 'Content-Type');
    if (preparedBody.contentType && !getHeader(headers, 'Content-Type')) setHeader(headers, 'Content-Type', preparedBody.contentType);
    const { apiKeyCookie } = applySimpleAuth(draft.auth, target, headers);
    const explicitCookieHeader = getHeader(headers, 'Cookie');
    applyCookieHeader(headers, envelope.cookieJar === 'session' ? cookiesForUrl(state, sessionId, target) : [], explicitCookieHeader, apiKeyCookie);

    let intercepted: FlexDocHostExecutionRequest = { method: nextMethod, url: target.toString(), headers: [...headers], body: preparedBody.body };
    if (state.options.interceptor) intercepted = await state.options.interceptor(intercepted);
    const interceptedUrl = new URL(intercepted.url);
    assertHostExecutionUrlAllowed(interceptedUrl, allowedOrigins);
    const finalMethod = String(intercepted.method || nextMethod).toUpperCase();
    const finalHeaders = intercepted.headers.map(([key, value]) => [String(key), String(value)] as HeaderEntry);
    const finalBody = intercepted.body;
    applyAdvancedAuth(draft.auth, finalMethod, interceptedUrl, finalHeaders, finalBody);

    const started = Date.now();
    let raw: RawResponse;
    if (draft.auth?.type === 'digest') {
      deleteHeader(finalHeaders, 'Authorization');
      const challenge = await requestOnce(interceptedUrl, finalMethod, finalHeaders, finalBody, timeoutMs, agent);
      if (envelope.cookieJar === 'session' && challenge.setCookies.length) storeSetCookies(state, sessionId, interceptedUrl, challenge.setCookies);
      if (challenge.status !== 401) raw = challenge;
      else {
        const digest = responseHeader(challenge.headers, 'WWW-Authenticate');
        if (!digest) throw new HostExecutionUnsupportedError('Server did not return a Digest challenge.');
        setHeader(finalHeaders, 'Authorization', digestHeader(draft.auth, digest, finalMethod, interceptedUrl));
        applyCookieHeader(finalHeaders, envelope.cookieJar === 'session' ? cookiesForUrl(state, sessionId, interceptedUrl) : [], explicitCookieHeader, apiKeyCookie);
        raw = await requestOnce(interceptedUrl, finalMethod, finalHeaders, finalBody, timeoutMs, agent);
      }
    } else {
      raw = await requestOnce(interceptedUrl, finalMethod, finalHeaders, finalBody, timeoutMs, agent);
    }
    if (envelope.cookieJar === 'session' && raw.setCookies.length) storeSetCookies(state, sessionId, interceptedUrl, raw.setCookies);

    if (raw.status >= 300 && raw.status < 400 && raw.location) {
      if (redirectCount >= MAX_REDIRECTS) throw new HostExecutionForbiddenError('Host execution stopped after too many redirects.');
      const redirectUrl = new URL(raw.location, interceptedUrl);
      if (redirectUrl.origin !== interceptedUrl.origin) throw new HostExecutionForbiddenError('Host execution does not follow cross-origin redirects.');
      assertHostExecutionUrlAllowed(redirectUrl, allowedOrigins);
      const redirectMethod = raw.status === 303 ? 'GET' : finalMethod;
      return executeAt(redirectUrl, redirectMethod, redirectCount + 1);
    }

    return {
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers,
      body: raw.body.toString('utf8'),
      responseTime: Date.now() - started,
      ...(envelope.cookieJar === 'session' ? { cookies: publicCookiesForSession(state, sessionId) } : {}),
    };
  };

  try {
    return await executeAt(initialUrl, method, 0);
  } finally {
    agent?.destroy();
  }
}

/** Execute one API-host request on behalf of the browser renderer. */
export async function executeHostRequest(
  state: HostExecutionState,
  envelope: ParsedHostExecutionEnvelope,
  context: { spec: any; sessionId: string; docsOrigin?: string },
): Promise<HostExecutionResponse> {
  if (!state.enabled) throw new HostExecutionUnsupportedError('Host execution is disabled on this documentation server.');
  return sendPrepared(state, envelope, context.spec, context.sessionId, context.docsOrigin);
}
