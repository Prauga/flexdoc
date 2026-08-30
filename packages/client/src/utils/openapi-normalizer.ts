import type { OpenAPISpec, Operation, Parameter, PathItem, Reference, RequestBody, Response, SecurityRequirement, Server } from '../types/openapi';
import {
  normalizeOperation as coreNormalizeOperation,
  resolveObject as coreResolveObject,
  resolvePathItem as coreResolvePathItem,
  resolveServerVariables as coreResolveServerVariables,
} from '../../../../core/dist/openapi-normalizer.js';

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

export function resolveObject<T>(spec: OpenAPISpec, value: T | Reference | undefined): T | undefined {
  return coreResolveObject(spec, value) as T | undefined;
}
export function resolvePathItem(spec: OpenAPISpec, path: string): PathItem { return coreResolvePathItem(spec, path) as PathItem; }
export function resolveServerVariables(server: Server, values: Record<string, string> = {}): string { return coreResolveServerVariables(server, values); }
export function normalizeOperation(spec: OpenAPISpec, path: string, method: string): NormalizedOperation {
  return coreNormalizeOperation(spec, path, method) as NormalizedOperation;
}
