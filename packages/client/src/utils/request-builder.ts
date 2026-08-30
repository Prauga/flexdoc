import { OpenAPISpec, Parameter, Schema, SecurityScheme } from '../types/openapi';
import { normalizeOperation, resolveObject, resolveServerVariables } from './openapi-normalizer';

export type RequestValue = string | number | boolean | string[] | number[] | Record<string, unknown>;

export interface RequestValues {
  parameters?: Record<string, RequestValue>;
  headers?: Record<string, string>;
  cookies?: Record<string, RequestValue>;
  body?: string;
  contentType?: string;
  auth?: Record<string, string>;
  serverUrl?: string;
  serverVariables?: Record<string, string>;
}

export interface BuiltRequest {
  url: string;
  init: RequestInit;
  method: string;
  headers: Record<string, string>;
  body?: string;
  bodyKind?: 'json' | 'text' | 'form' | 'multipart';
}

export function operationFor(spec: OpenAPISpec, path: string, method: string) {
  return normalizeOperation(spec, path, method).operation;
}

export function parametersFor(spec: OpenAPISpec, path: string, method: string): Parameter[] {
  return normalizeOperation(spec, path, method).parameters;
}

function schemaFor(spec: OpenAPISpec, parameter: Parameter): Schema | undefined {
  return resolveObject<Schema>(spec, parameter.schema);
}

function parameterExample(spec: OpenAPISpec, parameter: Parameter): RequestValue {
  if (parameter.example !== undefined) return parameter.example;
  const schema = schemaFor(spec, parameter);
  if (schema?.example !== undefined) return schema.example;
  if (schema?.examples?.length) return schema.examples[0];
  if (schema?.default !== undefined) return schema.default;
  if (schema?.enum?.length) return schema.enum[0];
  if (schema?.type === 'array') return [];
  if (schema?.type === 'object') return {};
  if (schema?.type === 'integer' || schema?.type === 'number') return 1;
  if (schema?.type === 'boolean') return true;
  return '';
}

export function initialRequestValues(spec: OpenAPISpec, path: string, method: string): RequestValues {
  const normalized = normalizeOperation(spec, path, method);
  const values: RequestValues = { parameters: {}, headers: {}, cookies: {}, auth: {} };
  for (const parameter of normalized.parameters) {
    const target = parameter.in === 'header' ? values.headers : parameter.in === 'cookie' ? values.cookies : values.parameters;
    (target as Record<string, RequestValue>)[parameter.name] = parameterExample(spec, parameter);
  }
  const requestBody = normalized.requestBody;
  const contentType = requestBody ? Object.keys(requestBody.content || {})[0] : undefined;
  if (contentType) {
    values.contentType = contentType;
    const media = requestBody!.content[contentType];
    const schema = resolveObject<Schema>(spec, media.schema);
    const namedExample = media.examples ? Object.values(media.examples)[0] : undefined;
    const resolvedNamedExample = resolveObject<any>(spec, namedExample as any);
    const example = media.example ?? resolvedNamedExample?.value ?? schema?.example ?? schema?.examples?.[0] ?? schema?.default;
    values.body = example !== undefined ? JSON.stringify(example, null, 2) : '';
  }
  return values;
}

function primitive(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function asStructured(value: RequestValue): RequestValue {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function encodePart(value: unknown, allowReserved = false): string {
  const text = primitive(value);
  return allowReserved ? encodeURI(text).replace(/%5B/g, '[').replace(/%5D/g, ']') : encodeURIComponent(text);
}

function serializeSimple(value: RequestValue, explode = false): string {
  const structured = asStructured(value);
  if (Array.isArray(structured)) return structured.map(primitive).join(',');
  if (structured && typeof structured === 'object') {
    const pairs = Object.entries(structured);
    return explode ? pairs.map(([k, v]) => `${k}=${primitive(v)}`).join(',') : pairs.flatMap(([k, v]) => [k, primitive(v)]).join(',');
  }
  return primitive(structured);
}

function serializePath(parameter: Parameter, value: RequestValue): string {
  const style = parameter.style || 'simple';
  const explode = parameter.explode ?? false;
  const structured = asStructured(value);
  const encode = (item: unknown) => encodePart(item, parameter.allowReserved);

  if (Array.isArray(structured)) {
    const items = structured.map(encode);
    if (style === 'label') return `.${items.join(explode ? '.' : ',')}`;
    if (style === 'matrix') return explode
      ? items.map((item) => `;${parameter.name}=${item}`).join('')
      : `;${parameter.name}=${items.join(',')}`;
    return items.join(',');
  }

  if (structured && typeof structured === 'object') {
    const entries = Object.entries(structured).map(([key, item]) => [encode(key), encode(item)] as const);
    if (style === 'label') return explode
      ? `.${entries.map(([key, item]) => `${key}=${item}`).join('.')}`
      : `.${entries.flatMap(([key, item]) => [key, item]).join(',')}`;
    if (style === 'matrix') return explode
      ? entries.map(([key, item]) => `;${key}=${item}`).join('')
      : `;${parameter.name}=${entries.flatMap(([key, item]) => [key, item]).join(',')}`;
    return explode
      ? entries.map(([key, item]) => `${key}=${item}`).join(',')
      : entries.flatMap(([key, item]) => [key, item]).join(',');
  }

  const item = encode(structured);
  if (style === 'label') return `.${item}`;
  if (style === 'matrix') return `;${parameter.name}=${item}`;
  return item;
}

function serializeQuery(parameter: Parameter, value: RequestValue): Array<[string, string]> {
  const style = parameter.style || 'form';
  const explode = parameter.explode ?? (style === 'form');
  const structured = asStructured(value);
  if (style === 'deepObject' && structured && typeof structured === 'object' && !Array.isArray(structured)) {
    return Object.entries(structured).map(([key, item]) => [`${parameter.name}[${key}]`, primitive(item)]);
  }
  if (Array.isArray(structured)) {
    if (style === 'spaceDelimited') return [[parameter.name, structured.map(primitive).join(' ')]];
    if (style === 'pipeDelimited') return [[parameter.name, structured.map(primitive).join('|')]];
    return explode ? structured.map((item) => [parameter.name, primitive(item)]) : [[parameter.name, structured.map(primitive).join(',')]];
  }
  if (structured && typeof structured === 'object') {
    const objectEntries = Object.entries(structured);
    return explode
      ? objectEntries.map(([key, item]) => [key, primitive(item)])
      : [[parameter.name, objectEntries.flatMap(([key, item]) => [key, primitive(item)]).join(',')]];
  }
  return [[parameter.name, primitive(structured)]];
}

function encodeBasicCredential(value: string): string {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(unescape(encodeURIComponent(value)));
  return value;
}

function authRequirementSatisfied(requirement: Record<string, string[]>, auth: Record<string, string>): boolean {
  return Object.keys(requirement).every((name) => !!auth[name]);
}

function applySecurity(spec: OpenAPISpec, requirements: Record<string, string[]>[], headers: Record<string, string>, query: string[], cookies: string[], auth: Record<string, string>) {
  if (!requirements.length || !spec.components?.securitySchemes) return;
  const requirement = requirements.find((candidate) => Object.keys(candidate).length === 0 || authRequirementSatisfied(candidate, auth)) || requirements[0];
  for (const schemeName of Object.keys(requirement)) {
    const scheme = resolveObject<SecurityScheme>(spec, spec.components.securitySchemes[schemeName]);
    const value = auth[schemeName];
    if (!scheme || !value) continue;
    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') headers.Authorization = `Bearer ${value}`;
    else if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') headers.Authorization = `Basic ${encodeBasicCredential(value)}`;
    else if (scheme.type === 'apiKey' && scheme.in === 'header' && scheme.name) headers[scheme.name] = value;
    else if (scheme.type === 'apiKey' && scheme.in === 'query' && scheme.name) query.push(`${encodeURIComponent(scheme.name)}=${encodeURIComponent(value)}`);
    else if (scheme.type === 'apiKey' && scheme.in === 'cookie' && scheme.name) cookies.push(`${scheme.name}=${encodeURIComponent(value)}`);
    else if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') headers.Authorization = `Bearer ${value}`;
  }
}

function parseBodyObject(body: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function buildRequest(spec: OpenAPISpec, path: string, method: string, values: RequestValues = {}): BuiltRequest {
  const normalized = normalizeOperation(spec, path, method);
  const serverObject = normalized.servers[0];
  const server = values.serverUrl || (serverObject ? resolveServerVariables(serverObject, values.serverVariables) : '');
  let resolvedPath = path;
  const query: string[] = [];
  const headers: Record<string, string> = { ...(values.headers || {}) };
  const cookies: string[] = [];

  for (const parameter of normalized.parameters) {
    const value = parameter.in === 'header'
      ? values.headers?.[parameter.name]
      : parameter.in === 'cookie'
        ? values.cookies?.[parameter.name]
        : values.parameters?.[parameter.name];
    if (value === undefined || value === '') continue;
    if (parameter.in === 'path') {
      resolvedPath = resolvedPath.replace(`{${parameter.name}}`, serializePath(parameter, value));
    } else if (parameter.in === 'query') {
      for (const [key, item] of serializeQuery(parameter, value)) {
        query.push(`${encodeURIComponent(key)}=${encodePart(item, parameter.allowReserved)}`);
      }
    } else if (parameter.in === 'header') headers[parameter.name] = serializeSimple(value, parameter.explode);
    else if (parameter.in === 'cookie') cookies.push(`${parameter.name}=${encodeURIComponent(serializeSimple(value, parameter.explode))}`);
  }

  applySecurity(spec, normalized.security, headers, query, cookies, values.auth || {});
  if (cookies.length) headers.Cookie = cookies.join('; ');

  let body: string | undefined;
  let bodyKind: BuiltRequest['bodyKind'];
  let requestBody: BodyInit | undefined;
  if (values.body && !['GET', 'HEAD'].includes(normalized.method)) {
    const contentType = values.contentType || 'application/json';
    body = values.body;
    if (contentType === 'application/x-www-form-urlencoded') {
      const object = parseBodyObject(values.body);
      body = object
        ? Object.entries(object).flatMap(([key, item]) => Array.isArray(item)
          ? item.map((entry) => `${encodeURIComponent(key)}=${encodeURIComponent(primitive(entry))}`)
          : [`${encodeURIComponent(key)}=${encodeURIComponent(primitive(item))}`]).join('&')
        : values.body;
      requestBody = body;
      bodyKind = 'form';
      headers['Content-Type'] = contentType;
    } else if (contentType.startsWith('multipart/form-data')) {
      const object = parseBodyObject(values.body);
      if (object && typeof FormData !== 'undefined') {
        const form = new FormData();
        for (const [key, item] of Object.entries(object)) {
          if (Array.isArray(item)) item.forEach((entry) => form.append(key, primitive(entry)));
          else form.append(key, primitive(item));
        }
        requestBody = form;
      } else requestBody = values.body;
      bodyKind = 'multipart';
    } else {
      requestBody = values.body;
      bodyKind = contentType.includes('json') ? 'json' : 'text';
      headers['Content-Type'] = contentType;
    }
  }

  const queryString = query.join('&');
  const url = `${server.replace(/\/$/, '')}${resolvedPath}${queryString ? `?${queryString}` : ''}`;
  return { url, method: normalized.method, headers, body, bodyKind, init: { method: normalized.method, headers, body: requestBody } };
}
