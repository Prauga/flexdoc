import type { OpenAPISpec } from '../types/openapi';
import type { HttpRequestDraft } from './http-client';
import { requestDraftFromOpenApiRequest } from './openapi-api-client-auth';
import { buildRequest } from './request-builder';
import type { RequestValues } from './request-builder';

/** API Client handoff generated from one live OpenAPI Try It operation. */
export interface OpenApiApiClientSession {
  /** Editable request draft handed off to the API Client. */
  request: HttpRequestDraft;
  /** Effective server URL selected by Try It, retained for API Client server controls. */
  serverUrl?: string;
}

/**
 * Convert the live editable values of one OpenAPI operation into the canonical
 * API Client request representation used by workspace requests.
 *
 * Transport construction stays an implementation detail of this conversion;
 * callers hand the resulting `HttpRequestDraft` across the Try It/API Client
 * boundary instead of passing a `BuiltRequest` and reconstructing editor state.
 *
 * @param spec Root OpenAPI document containing the operation.
 * @param path OpenAPI path-template key.
 * @param method HTTP method, case-insensitive.
 * @param values Current Try It parameter/body/auth/server values.
 * @param fallbackServerUrl Server URL retained when the editable values do not contain an explicit selection.
 * @returns API Client draft plus effective server selection.
 */
export function createOpenApiApiClientSession(
  spec: OpenAPISpec,
  path: string,
  method: string,
  values: RequestValues,
  fallbackServerUrl?: string,
): OpenApiApiClientSession {
  const builtRequest = buildRequest(spec, path, method, values);
  return {
    request: requestDraftFromOpenApiRequest(spec, path, method, values, builtRequest),
    serverUrl: values.serverUrl || fallbackServerUrl,
  };
}
