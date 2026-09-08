import type { IncomingMessage } from 'http';
import {
  HostExecutionBadRequestError,
  HostExecutionForbiddenError,
  HostExecutionUnsupportedError,
  clearCookiesForSession,
  ensureHostExecutionSession,
  executeHostRequest,
  publicCookiesForSession,
} from './host-execution';
import type { HostExecutionState, ParsedHostExecutionEnvelope, HostExecutionUploadedFile } from './host-execution';

const MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024;

type HeaderValue = string | string[] | undefined;
/** Case-insensitive HTTP-header source accepted by host-execution route helpers. */
export type HostExecutionHeaderSource = Record<string, HeaderValue>;

/** Framework-neutral HTTP response envelope returned by host-execution route helpers. */
export interface HostExecutionRouteResult {
  /** HTTP status code to send to the documentation browser. */ status: number;
  /** Response headers to send to the documentation browser. */ headers: Record<string, string>;
  /** JSON response body text. */ body: string;
}

function headerValue(headers: HostExecutionHeaderSource, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== target) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

/** Input used to infer the documentation origin from framework request metadata. */
export interface HostExecutionRequestOriginInput {
  /** Incoming request headers containing the Host header fallback. */ headers: HostExecutionHeaderSource;
  /** Framework-reported protocol, with or without a trailing colon. */ protocol?: string;
  /** Absolute request URL when the framework exposes one. */ url?: string;
}

/**
 * Infer the documentation request's HTTP(S) origin.
 * @param input Absolute request URL or protocol/Host metadata.
 * @returns Normalized origin, or `undefined` when the request metadata is insufficient/invalid.
 */
export function hostExecutionRequestOrigin(input: HostExecutionRequestOriginInput): string | undefined {
  if (input.url) {
    try {
      const parsed = new URL(input.url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    } catch { /* fall through to protocol + Host */ }
  }
  const host = headerValue(input.headers, 'Host');
  const protocol = String(input.protocol || '').replace(/:$/, '').toLowerCase();
  if (!host || (protocol !== 'http' && protocol !== 'https')) return undefined;
  try { return new URL(`${protocol}://${host}`).origin; } catch { return undefined; }
}

function asBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (value === undefined || value === null) return Buffer.alloc(0);
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HostExecutionBadRequestError('Host execution body must be a JSON object.');
  return value as Record<string, unknown>;
}

function validateEnvelope(value: unknown): ParsedHostExecutionEnvelope {
  const object = jsonObject(value);
  if (!object.request || typeof object.request !== 'object' || Array.isArray(object.request)) throw new HostExecutionBadRequestError('Host execution body requires a canonical request draft.');
  return object as unknown as ParsedHostExecutionEnvelope;
}

function multipartBoundary(contentType: string): string {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] || match?.[2];
  if (!boundary) throw new HostExecutionBadRequestError('Multipart host execution is missing a boundary.');
  if (boundary.length > 200) throw new HostExecutionBadRequestError('Multipart boundary is too long.');
  return boundary;
}

function dispositionValue(headers: string, key: string): string | undefined {
  const line = headers.split('\r\n').find((candidate) => candidate.toLowerCase().startsWith('content-disposition:'));
  if (!line) return undefined;
  const match = new RegExp(`(?:^|;)\\s*${key}="([^"]*)"`, 'i').exec(line.slice(line.indexOf(':') + 1));
  return match?.[1];
}

function partContentType(headers: string): string | undefined {
  const line = headers.split('\r\n').find((candidate) => candidate.toLowerCase().startsWith('content-type:'));
  return line ? line.slice(line.indexOf(':') + 1).trim() : undefined;
}

/**
 * Parse a host-execution request body from JSON or multipart form data.
 * @param contentType Incoming Content-Type header.
 * @param incoming Framework-parsed object, string, Uint8Array, or Buffer body.
 * @returns Validated execution envelope with uploaded multipart files attached by form-row index.
 * @throws `HostExecutionBadRequestError` for invalid media types, malformed JSON/multipart data, or missing descriptors.
 */
export function parseHostExecutionRequestBody(contentType: string | undefined, incoming: unknown): ParsedHostExecutionEnvelope {
  const mediaType = (contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (mediaType === 'application/json') {
    if (incoming && typeof incoming === 'object' && !Buffer.isBuffer(incoming) && !(incoming instanceof Uint8Array)) return validateEnvelope(incoming);
    const raw = asBuffer(incoming).toString('utf8').trim();
    if (!raw) throw new HostExecutionBadRequestError('Host execution request body is empty.');
    try { return validateEnvelope(JSON.parse(raw)); } catch (error) {
      if (error instanceof HostExecutionBadRequestError) throw error;
      throw new HostExecutionBadRequestError('Host execution request body is not valid JSON.');
    }
  }
  if (mediaType !== 'multipart/form-data') throw new HostExecutionBadRequestError('Host execution requires application/json or multipart/form-data.');

  const body = asBuffer(incoming);
  const boundary = Buffer.from(`--${multipartBoundary(contentType || '')}`, 'utf8');
  let cursor = body.indexOf(boundary);
  let descriptor: ParsedHostExecutionEnvelope | undefined;
  const files = new Map<number, HostExecutionUploadedFile>();
  while (cursor >= 0) {
    let start = cursor + boundary.length;
    if (body.subarray(start, start + 2).toString('ascii') === '--') break;
    if (body.subarray(start, start + 2).toString('ascii') === '\r\n') start += 2;
    const next = body.indexOf(boundary, start);
    if (next < 0) break;
    let end = next;
    if (body.subarray(end - 2, end).toString('ascii') === '\r\n') end -= 2;
    const part = body.subarray(start, end);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n', 'ascii'));
    if (headerEnd < 0) throw new HostExecutionBadRequestError('Malformed multipart host execution part.');
    const headers = part.subarray(0, headerEnd).toString('utf8');
    const data = part.subarray(headerEnd + 4);
    const name = dispositionValue(headers, 'name');
    if (name === 'descriptor') {
      try { descriptor = validateEnvelope(JSON.parse(data.toString('utf8'))); } catch (error) {
        if (error instanceof HostExecutionBadRequestError) throw error;
        throw new HostExecutionBadRequestError('Multipart host execution descriptor is not valid JSON.');
      }
    } else {
      const match = /^formData\[(\d+)\]$/.exec(name || '');
      if (match) files.set(Number(match[1]), {
        name: dispositionValue(headers, 'filename') || 'upload.bin',
        contentType: partContentType(headers),
        data: Buffer.from(data),
      });
    }
    cursor = next;
  }
  if (!descriptor) throw new HostExecutionBadRequestError('Multipart host execution requires a descriptor part.');
  descriptor.formDataFiles = files;
  return descriptor;
}

/**
 * Read an incoming Node request body with FlexDoc's host-execution size limit.
 * @param request Node `IncomingMessage` stream.
 * @returns Concatenated request body bytes.
 * @throws `HostExecutionBadRequestError` when the body exceeds 32 MiB.
 */
export async function readNodeRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_EXECUTION_REQUEST_BYTES) throw new HostExecutionBadRequestError('Host execution request exceeded the 32 MiB safety limit.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function response(status: number, payload: unknown, setCookie?: string): HostExecutionRouteResult {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    },
    body: JSON.stringify(payload),
  };
}

function errorStatus(error: unknown): number {
  if (error instanceof HostExecutionForbiddenError) return 403;
  if (error instanceof HostExecutionBadRequestError) return 400;
  if (error instanceof HostExecutionUnsupportedError) return 400;
  return 502;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'API host execution failed.';
}

/** Input accepted by the framework-neutral host-execution POST route helper. */
export interface RunHostExecutionRouteInput {
  /** Shared server-side host-execution state. */ state: HostExecutionState;
  /** OpenAPI document used to derive default allowed target origins. */ spec: unknown;
  /** Incoming request headers. */ headers: HostExecutionHeaderSource;
  /** Framework-parsed or raw incoming request body. */ body: unknown;
  /** Documentation-host origin used to resolve relative OpenAPI server URLs. */ docsOrigin?: string;
}

/**
 * Handle one host-execution POST route and return an HTTP response envelope.
 * @param input Host state, spec, incoming headers/body, and optional documentation origin.
 * @returns JSON route response. Known execution errors are translated to 400/403; upstream failures become 502.
 */
export async function runHostExecutionRoute(input: RunHostExecutionRouteInput): Promise<HostExecutionRouteResult> {
  if (headerValue(input.headers, 'X-FlexDoc-Execute') !== '1') return response(403, { error: 'Missing X-FlexDoc-Execute header.' });
  let session: { sessionId: string; setCookie?: string } = { sessionId: '' };
  try {
    const envelope = parseHostExecutionRequestBody(headerValue(input.headers, 'Content-Type'), input.body);
    if (envelope.cookieJar === 'session') session = ensureHostExecutionSession(input.state, headerValue(input.headers, 'Cookie'));
    const result = await executeHostRequest(input.state, envelope, {
      spec: input.spec,
      sessionId: session.sessionId,
      docsOrigin: input.docsOrigin,
    });
    return response(200, result, session.setCookie);
  } catch (error) {
    return response(errorStatus(error), { error: errorMessage(error) }, session.setCookie);
  }
}

/** Input accepted by the host cookie-jar read/clear route helper. */
export interface RunHostCookiesRouteInput {
  /** Shared server-side host-execution state. */ state: HostExecutionState;
  /** Incoming request headers carrying the FlexDoc session cookie and execution marker. */ headers: HostExecutionHeaderSource;
  /** Clear the session jar before returning its contents. */ clear?: boolean;
}

/**
 * Handle host cookie-jar read and clear routes for API-host execution.
 * @param input Host state, incoming headers, and optional clear flag.
 * @returns JSON route response containing the session's public cookie list.
 */
export function runHostCookiesRoute(input: RunHostCookiesRouteInput): HostExecutionRouteResult {
  if (headerValue(input.headers, 'X-FlexDoc-Execute') !== '1') return response(403, { error: 'Missing X-FlexDoc-Execute header.' });
  const session = ensureHostExecutionSession(input.state, headerValue(input.headers, 'Cookie'));
  if (input.clear) clearCookiesForSession(input.state, session.sessionId);
  return response(200, { cookies: publicCookiesForSession(input.state, session.sessionId) }, session.setCookie);
}
