import type { OpenAPISpec, Operation, Parameter } from '../types/openapi';
import {
  buildRequest as coreBuildRequest,
  initialRequestValues as coreInitialRequestValues,
  operationFor as coreOperationFor,
  parametersFor as coreParametersFor,
} from '../../../../core/dist/request-builder.js';

export type RequestValue = string | number | boolean | string[] | number[] | Record<string, unknown>;
/** User-entered Try It values keyed by parameter location and name. */
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
/** Canonical fetch-ready request produced from an OpenAPI operation and values. */
export interface BuiltRequest {
  url: string;
  init: RequestInit;
  method: string;
  headers: Record<string, string>;
  body?: string;
  bodyKind?: 'json' | 'text' | 'form' | 'multipart' | 'binary';
}

export function operationFor(spec: OpenAPISpec, path: string, method: string): Operation { return coreOperationFor(spec, path, method) as Operation; }
export function parametersFor(spec: OpenAPISpec, path: string, method: string): Parameter[] { return coreParametersFor(spec, path, method) as Parameter[]; }
/** Default Try It values derived from OpenAPI examples and schemas. */
export function initialRequestValues(spec: OpenAPISpec, path: string, method: string): RequestValues { return coreInitialRequestValues(spec, path, method) as RequestValues; }
/** Build a transport request for one OpenAPI operation. */
export function buildRequest(spec: OpenAPISpec, path: string, method: string, values: RequestValues = {}): BuiltRequest {
  return coreBuildRequest(spec, path, method, values) as BuiltRequest;
}
