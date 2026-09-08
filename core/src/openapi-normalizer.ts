import type { OpenAPISpec, Operation, Parameter, PathItem, Reference, RequestBody, Response, SecurityRequirement, Server } from './types/openapi.js';
import { OpenAPIParser } from './openapi-parser.js';

/** Resolved operation view with parameters, request body, and security metadata. */
export interface NormalizedOperation {
  /** OpenAPI path template containing the operation. */
  path: string;
  /** Uppercase HTTP method for the operation. */
  method: string;
  /** Resolved path item containing the operation. */
  pathItem: PathItem;
  /** Resolved operation object. */
  operation: Operation;
  /** Path- and operation-level parameters merged by location/name. */
  parameters: Parameter[];
  /** Resolved request body when the operation defines one. */
  requestBody?: RequestBody;
  /** Resolved responses keyed by OpenAPI response code. */
  responses: Record<string, Response>;
  /** Effective operation servers after operation/path/document fallback. */
  servers: Server[];
  /** Effective security requirements after operation/document fallback. */
  security: SecurityRequirement[];
}

/**
 * Resolve a possibly referenced OpenAPI object against the root document.
 * @param spec Root OpenAPI document used for local reference resolution.
 * @param value Inline value, reference object, or `undefined`.
 * @returns Resolved value, or `undefined` when no value was supplied.
 */
export function resolveObject<T>(spec: OpenAPISpec, value: T | Reference | undefined): T | undefined {
  if (!value) return undefined;
  return OpenAPIParser.isReference(value) ? OpenAPIParser.resolveReference(spec, value.$ref) as T : value as T;
}

/**
 * Resolve a path item, following a `$ref` when present.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key to resolve.
 * @returns Resolved path item.
 * @throws When the path is absent from the document.
 */
export function resolvePathItem(spec: OpenAPISpec, path: string): PathItem {
  const raw = spec.paths[path] as PathItem | Reference | undefined;
  if (!raw) throw new Error(`Path not found: ${path}`);
  return resolveObject<PathItem>(spec, raw)!;
}

/**
 * Substitute server URL template variables.
 * @param server OpenAPI server definition containing the URL template.
 * @param values Explicit variable values overriding server defaults.
 * @returns Fully substituted server URL.
 * @throws When a variable has no value or violates an enumerated constraint.
 */
export function resolveServerVariables(server: Server, values: Record<string, string> = {}): string {
  return server.url.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const variable = server.variables?.[name];
    const value = values[name] ?? variable?.default;
    if (value === undefined) throw new Error(`Missing server variable: ${name}`);
    if (variable?.enum?.length && !variable.enum.includes(value)) throw new Error(`Invalid value for server variable ${name}: ${value}`);
    return value;
  });
}

/**
 * Normalize one operation with merged parameters, servers, security, and resolved references.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @returns Canonical resolved operation view used by request construction and rendering.
 * @throws When the requested operation does not exist.
 */
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
