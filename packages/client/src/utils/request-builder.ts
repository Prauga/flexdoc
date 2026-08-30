import type { OpenAPISpec, Operation, Parameter } from '../types/openapi';
import {
  buildRequest as coreBuildRequest,
  initialRequestValues as coreInitialRequestValues,
  operationFor as coreOperationFor,
  parametersFor as coreParametersFor,
} from '../../../../core/src/request-builder';

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

export function operationFor(spec: OpenAPISpec, path: string, method: string): Operation { return coreOperationFor(spec, path, method) as Operation; }
export function parametersFor(spec: OpenAPISpec, path: string, method: string): Parameter[] { return coreParametersFor(spec, path, method) as Parameter[]; }
export function initialRequestValues(spec: OpenAPISpec, path: string, method: string): RequestValues { return coreInitialRequestValues(spec, path, method) as RequestValues; }
export function buildRequest(spec: OpenAPISpec, path: string, method: string, values: RequestValues = {}): BuiltRequest {
  return coreBuildRequest(spec, path, method, values) as BuiltRequest;
}
