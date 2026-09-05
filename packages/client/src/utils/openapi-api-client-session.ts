import type { OpenAPISpec } from '../types/openapi';
import type { HttpRequestDraft } from './http-client';
import { requestDraftFromOpenApiRequest } from './openapi-api-client-auth';
import { buildRequest } from './request-builder';
import type { RequestValues } from './request-builder';

export interface OpenApiApiClientSession {
  request: HttpRequestDraft;
  serverUrl?: string;
}

/**
 * Converts the live editable values of one OpenAPI operation into the
 * canonical API Client request representation used by workspace requests.
 *
 * Transport construction stays an implementation detail of this conversion;
 * callers hand the resulting HttpRequestDraft across the Try It/API Client
 * boundary instead of passing a BuiltRequest and reconstructing editor state.
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
