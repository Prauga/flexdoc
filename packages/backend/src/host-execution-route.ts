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
export type HostExecutionHeaderSource = Record<string, HeaderValue>;

export interface HostExecutionRouteResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function headerValue(headers: HostExecutionHeaderSource, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== target) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

export function hostExecutionRequestOrigin(input: {
  headers: HostExecutionHeaderSource;
  protocol?: string;
  url?: string;
}): string | undefined {
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

/** Parse a host-execution request body from JSON or multipart form data. */
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

/** Handle one host-execution POST route and return an HTTP response envelope. */
export async function runHostExecutionRoute(input: {
  state: HostExecutionState;
  spec: unknown;
  headers: HostExecutionHeaderSource;
  body: unknown;
  docsOrigin?: string;
}): Promise<HostExecutionRouteResult> {
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

/** Handle host cookie-jar read and clear routes for API-host execution. */
export function runHostCookiesRoute(input: {
  state: HostExecutionState;
  headers: HostExecutionHeaderSource;
  clear?: boolean;
}): HostExecutionRouteResult {
  if (headerValue(input.headers, 'X-FlexDoc-Execute') !== '1') return response(403, { error: 'Missing X-FlexDoc-Execute header.' });
  const session = ensureHostExecutionSession(input.state, headerValue(input.headers, 'Cookie'));
  if (input.clear) clearCookiesForSession(input.state, session.sessionId);
  return response(200, { cookies: publicCookiesForSession(input.state, session.sessionId) }, session.setCookie);
}
