import { OpenAPISpec, Operation, Parameter, Reference, Schema } from '../types/openapi';
import { OpenAPIParser } from './openapi-parser';

export interface RequestValues {
  parameters?: Record<string, string>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: string;
  contentType?: string;
  auth?: Record<string, string>;
  serverUrl?: string;
}

export interface BuiltRequest {
  url: string;
  init: RequestInit;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function resolveParameter(spec: OpenAPISpec, parameter: Parameter | Reference): Parameter {
  return OpenAPIParser.isReference(parameter)
    ? (OpenAPIParser.resolveReference(spec, parameter.$ref) as Parameter)
    : parameter;
}

export function operationFor(spec: OpenAPISpec, path: string, method: string): Operation {
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  if (!operation) throw new Error(`Operation not found: ${method.toUpperCase()} ${path}`);
  return operation;
}

export function parametersFor(spec: OpenAPISpec, path: string, method: string): Parameter[] {
  const pathItem = spec.paths[path];
  const operation = operationFor(spec, path, method);
  const merged = [...(pathItem.parameters || []), ...(operation.parameters || [])].map((p) =>
    resolveParameter(spec, p)
  );
  const byKey = new Map<string, Parameter>();
  for (const parameter of merged) byKey.set(`${parameter.in}:${parameter.name}`, parameter);
  return [...byKey.values()];
}

function encode(value: string, allowReserved = false): string {
  return allowReserved ? value : encodeURIComponent(value);
}

function parameterExample(parameter: Parameter): string {
  if (parameter.example !== undefined) return String(parameter.example);
  const schema = parameter.schema as Schema | undefined;
  if (schema?.example !== undefined) return String(schema.example);
  if (schema?.default !== undefined) return String(schema.default);
  if (schema?.enum?.length) return String(schema.enum[0]);
  if (schema?.type === 'integer' || schema?.type === 'number') return '1';
  if (schema?.type === 'boolean') return 'true';
  return '';
}

export function initialRequestValues(spec: OpenAPISpec, path: string, method: string): RequestValues {
  const values: RequestValues = { parameters: {}, headers: {}, cookies: {}, auth: {} };
  for (const parameter of parametersFor(spec, path, method)) {
    const target = parameter.in === 'header' ? values.headers : parameter.in === 'cookie' ? values.cookies : values.parameters;
    target![parameter.name] = parameterExample(parameter);
  }
  const operation = operationFor(spec, path, method);
  const requestBody = operation.requestBody && !OpenAPIParser.isReference(operation.requestBody)
    ? operation.requestBody
    : operation.requestBody && OpenAPIParser.isReference(operation.requestBody)
      ? (OpenAPIParser.resolveReference(spec, operation.requestBody.$ref) as any)
      : undefined;
  const contentType = requestBody ? Object.keys(requestBody.content || {})[0] : undefined;
  if (contentType) {
    values.contentType = contentType;
    const media = requestBody.content[contentType];
    const example = media.example ?? (media.schema && !OpenAPIParser.isReference(media.schema) ? media.schema.example : undefined);
    values.body = example !== undefined ? JSON.stringify(example, null, 2) : '';
  }
  return values;
}

function applySecurity(spec: OpenAPISpec, operation: Operation, headers: Record<string, string>, query: URLSearchParams, auth: Record<string, string>) {
  const requirements = operation.security ?? spec.security ?? [];
  if (!requirements.length || !spec.components?.securitySchemes) return;
  const requirement = requirements[0];
  for (const schemeName of Object.keys(requirement)) {
    const raw = spec.components.securitySchemes[schemeName];
    if (!raw) continue;
    const scheme: any = OpenAPIParser.isReference(raw) ? OpenAPIParser.resolveReference(spec, raw.$ref) : raw;
    const value = auth[schemeName];
    if (!value) continue;
    if (scheme.type === 'http' && scheme.scheme === 'bearer') headers.Authorization = `Bearer ${value}`;
    else if (scheme.type === 'http' && scheme.scheme === 'basic') headers.Authorization = `Basic ${value}`;
    else if (scheme.type === 'apiKey' && scheme.in === 'header' && scheme.name) headers[scheme.name] = value;
    else if (scheme.type === 'apiKey' && scheme.in === 'query' && scheme.name) query.set(scheme.name, value);
    else if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') headers.Authorization = `Bearer ${value}`;
  }
}

export function buildRequest(spec: OpenAPISpec, path: string, method: string, values: RequestValues = {}): BuiltRequest {
  const operation = operationFor(spec, path, method);
  const params = parametersFor(spec, path, method);
  const server = values.serverUrl || operation.servers?.[0]?.url || spec.paths[path]?.servers?.[0]?.url || spec.servers?.[0]?.url || '';
  let resolvedPath = path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { ...(values.headers || {}) };
  const cookies: string[] = [];

  for (const parameter of params) {
    const value = parameter.in === 'header'
      ? values.headers?.[parameter.name]
      : parameter.in === 'cookie'
        ? values.cookies?.[parameter.name]
        : values.parameters?.[parameter.name];
    if (value === undefined || value === '') continue;
    if (parameter.in === 'path') resolvedPath = resolvedPath.replace(`{${parameter.name}}`, encode(value, parameter.allowReserved));
    else if (parameter.in === 'query') query.append(parameter.name, value);
    else if (parameter.in === 'header') headers[parameter.name] = value;
    else if (parameter.in === 'cookie') cookies.push(`${parameter.name}=${encode(value)}`);
  }

  applySecurity(spec, operation, headers, query, values.auth || {});
  if (cookies.length) headers.Cookie = cookies.join('; ');
  let body: string | undefined;
  if (values.body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    body = values.body;
    headers['Content-Type'] = values.contentType || 'application/json';
  }
  const queryString = query.toString();
  const url = `${server.replace(/\/$/, '')}${resolvedPath}${queryString ? `?${queryString}` : ''}`;
  return { url, method: method.toUpperCase(), headers, body, init: { method: method.toUpperCase(), headers, body } };
}
