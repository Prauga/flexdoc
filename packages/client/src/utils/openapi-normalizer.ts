import type { OpenAPISpec, Operation, Parameter, PathItem, Reference, RequestBody, Response, SecurityRequirement, Server } from '../types/openapi';
import {
  normalizeOperation as coreNormalizeOperation,
  resolveObject as coreResolveObject,
  resolvePathItem as coreResolvePathItem,
  resolveServerVariables as coreResolveServerVariables,
} from '../../../../core/dist/openapi-normalizer.js';

/** Resolved operation view with parameters, request body, and security metadata. */
export interface NormalizedOperation {
  /** OpenAPI path template containing the operation. */ path: string;
  /** Uppercase HTTP method for the operation. */ method: string;
  /** Resolved path item containing the operation. */ pathItem: PathItem;
  /** Resolved operation object. */ operation: Operation;
  /** Path- and operation-level parameters merged by location/name. */ parameters: Parameter[];
  /** Resolved request body when the operation defines one. */ requestBody?: RequestBody;
  /** Resolved responses keyed by OpenAPI response code. */ responses: Record<string, Response>;
  /** Effective operation servers after operation/path/document fallback. */ servers: Server[];
  /** Effective security requirements after operation/document fallback. */ security: SecurityRequirement[];
}

/**
 * Resolve a possibly referenced OpenAPI object against the root document.
 * @param spec Root OpenAPI document used for local reference resolution.
 * @param value Inline value, reference object, or `undefined`.
 * @returns Resolved value, or `undefined` when no value was supplied.
 */
export function resolveObject<T>(spec: OpenAPISpec, value: T | Reference | undefined): T | undefined {
  return coreResolveObject(spec, value) as T | undefined;
}

/**
 * Resolve a path item, following a `$ref` when present.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key to resolve.
 * @returns Resolved path item.
 */
export function resolvePathItem(spec: OpenAPISpec, path: string): PathItem { return coreResolvePathItem(spec, path) as PathItem; }

/**
 * Substitute server URL template variables.
 * @param server OpenAPI server definition containing the URL template.
 * @param values Explicit variable values overriding server defaults.
 * @returns Fully substituted server URL.
 */
export function resolveServerVariables(server: Server, values: Record<string, string> = {}): string { return coreResolveServerVariables(server, values); }

/**
 * Normalize one operation with merged parameters, servers, security, and resolved references.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @returns Canonical resolved operation view used by rendering and request construction.
 */
export function normalizeOperation(spec: OpenAPISpec, path: string, method: string): NormalizedOperation {
  return coreNormalizeOperation(spec, path, method) as NormalizedOperation;
}
