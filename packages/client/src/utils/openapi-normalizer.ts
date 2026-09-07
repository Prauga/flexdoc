import type { OpenAPISpec, Operation, Parameter, PathItem, Reference, RequestBody, Response, SecurityRequirement, Server } from '../types/openapi';
import {
  normalizeOperation as coreNormalizeOperation,
  resolveObject as coreResolveObject,
  resolvePathItem as coreResolvePathItem,
  resolveServerVariables as coreResolveServerVariables,
} from '../../../../core/dist/openapi-normalizer.js';

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
  return coreResolveObject(spec, value) as T | undefined;
}
/** Resolve a path item, following a `$ref` when present. */
export function resolvePathItem(spec: OpenAPISpec, path: string): PathItem { return coreResolvePathItem(spec, path) as PathItem; }
/** Substitute server URL template variables. */
export function resolveServerVariables(server: Server, values: Record<string, string> = {}): string { return coreResolveServerVariables(server, values); }
/** Normalize one operation with merged parameters, servers, and security requirements. */
export function normalizeOperation(spec: OpenAPISpec, path: string, method: string): NormalizedOperation {
  return coreNormalizeOperation(spec, path, method) as NormalizedOperation;
}
