import type { OpenAPISpec, Operation, Parameter, PathItem, Reference, RequestBody, Response, SecurityRequirement, Server } from './types/openapi.js';
import { OpenAPIParser } from './openapi-parser.js';

/** Resolved operation view with parameters, request body, and security metadata. */
export interface NormalizedOperation {
  path: string;
  method: string;
  pathItem: PathItem;
  operation: Operation;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  servers: Server[];
  security: SecurityRequirement[];
}

/** Resolve a possibly referenced OpenAPI object against the root document. */
export function resolveObject<T>(spec: OpenAPISpec, value: T | Reference | undefined): T | undefined {
  if (!value) return undefined;
  return OpenAPIParser.isReference(value) ? OpenAPIParser.resolveReference(spec, value.$ref) as T : value as T;
}

/** Resolve a path item, following a `$ref` when present. */
export function resolvePathItem(spec: OpenAPISpec, path: string): PathItem {
  const raw = spec.paths[path] as PathItem | Reference | undefined;
  if (!raw) throw new Error(`Path not found: ${path}`);
  return resolveObject<PathItem>(spec, raw)!;
}

/** Substitute server URL template variables. */
export function resolveServerVariables(server: Server, values: Record<string, string> = {}): string {
  return server.url.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const variable = server.variables?.[name];
    const value = values[name] ?? variable?.default;
    if (value === undefined) throw new Error(`Missing server variable: ${name}`);
    if (variable?.enum?.length && !variable.enum.includes(value)) throw new Error(`Invalid value for server variable ${name}: ${value}`);
    return value;
  });
}

/** Normalize one operation with merged parameters, servers, and security requirements. */
export function normalizeOperation(spec: OpenAPISpec, path: string, method: string): NormalizedOperation {
  const pathItem = resolvePathItem(spec, path);
  const operation = pathItem[method.toLowerCase() as keyof PathItem] as Operation | undefined;
  if (!operation || typeof operation !== 'object' || !('responses' in operation)) throw new Error(`Operation not found: ${method.toUpperCase()} ${path}`);
  const merged = [...(pathItem.parameters || []), ...(operation.parameters || [])]
    .map((parameter) => resolveObject<Parameter>(spec, parameter))
    .filter((parameter): parameter is Parameter => !!parameter);
  const parameters = new Map<string, Parameter>();
  for (const parameter of merged) parameters.set(`${parameter.in}:${parameter.name}`, parameter);
  const responses: Record<string, Response> = {};
  for (const [status, response] of Object.entries(operation.responses || {})) {
    const resolved = resolveObject<Response>(spec, response);
    if (resolved) responses[status] = resolved;
  }
  return {
    path,
    method: method.toUpperCase(),
    pathItem,
    operation,
    parameters: [...parameters.values()],
    requestBody: resolveObject<RequestBody>(spec, operation.requestBody),
    responses,
    servers: operation.servers || pathItem.servers || spec.servers || [],
    security: operation.security !== undefined ? operation.security : (spec.security || []),
  };
}
