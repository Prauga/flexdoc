import type { OpenAPISpec, Operation, Parameter } from '../types/openapi';
import {
  buildRequest as coreBuildRequest,
  initialRequestValues as coreInitialRequestValues,
  operationFor as coreOperationFor,
  parametersFor as coreParametersFor,
} from '../../../../core/dist/request-builder.js';

/** Scalar request value accepted by OpenAPI parameter and auth editors. */
export type RequestValue = string | number | boolean | string[] | number[] | Record<string, unknown>;

/** User-entered Try It values keyed by parameter location and name. */
export interface RequestValues {
  /** Query/path parameter values keyed by OpenAPI parameter name. */ parameters?: Record<string, RequestValue>;
  /** Explicit request headers keyed by header name. */ headers?: Record<string, string>;
  /** Cookie parameter values keyed by OpenAPI cookie name. */ cookies?: Record<string, RequestValue>;
  /** Request body text entered by the user. */ body?: string;
  /** Media type selected for the request body. */ contentType?: string;
  /** Security-scheme credential values keyed by OpenAPI scheme name. */ auth?: Record<string, string>;
  /** Explicit server URL overriding the operation/document server list. */ serverUrl?: string;
  /** Values substituted into variables of the selected OpenAPI server. */ serverVariables?: Record<string, string>;
}

/** Canonical fetch-ready request produced from an OpenAPI operation and values. */
export interface BuiltRequest {
  /** Fully resolved request URL including server, path parameters, and query string. */ url: string;
  /** Fetch-compatible request initialization object. */ init: RequestInit;
  /** Uppercase HTTP method. */ method: string;
  /** Header record after parameter and security processing. */ headers: Record<string, string>;
  /** Serializable body preview when the request has a body. */ body?: string;
  /** Body representation used by renderer/editor tooling. */ bodyKind?: 'json' | 'text' | 'form' | 'multipart' | 'binary';
}

/**
 * Return the operation object for one path and HTTP method.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @returns Resolved operation object.
 */
export function operationFor(spec: OpenAPISpec, path: string, method: string): Operation { return coreOperationFor(spec, path, method) as Operation; }

/**
 * Return merged parameters for one operation.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @returns Path- and operation-level parameters merged by location/name.
 */
export function parametersFor(spec: OpenAPISpec, path: string, method: string): Parameter[] { return coreParametersFor(spec, path, method) as Parameter[]; }

/**
 * Derive default Try It values from OpenAPI examples and schemas.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @returns Editable values pre-populated from parameter/body examples and defaults.
 */
export function initialRequestValues(spec: OpenAPISpec, path: string, method: string): RequestValues { return coreInitialRequestValues(spec, path, method) as RequestValues; }

/**
 * Build a transport request for one OpenAPI operation.
 * @param spec Root OpenAPI document.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @param values User-entered parameter, body, auth, and server values.
 * @returns Fetch-ready canonical request with resolved URL, headers, body, and metadata.
 */
export function buildRequest(spec: OpenAPISpec, path: string, method: string, values: RequestValues = {}): BuiltRequest {
  return coreBuildRequest(spec, path, method, values) as BuiltRequest;
}
