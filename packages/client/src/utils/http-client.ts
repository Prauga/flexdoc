import {
  buildHttpRequest as coreBuildHttpRequest,
  requestDraftFromBuiltRequest as coreRequestDraftFromBuiltRequest,
  resolveHttpRequestDraftVariables as coreResolveHttpRequestDraftVariables,
} from '../../../../core/dist/http-client.js';
import type { BuiltRequest } from './request-builder';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'bearer'; token: string }
  | { type: 'oauth2'; accessToken: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; in: 'header' | 'query' };

export interface HttpRequestDraft {
  method: string;
  url: string;
  query?: HttpKeyValue[];
  headers?: HttpKeyValue[];
  body?: string;
  contentType?: string;
  auth?: HttpAuth;
}

export type HttpVariables = Record<string, string>;

export interface HttpRequestBuildOptions {
  variables?: HttpVariables;
}

export interface HttpBuiltRequest extends BuiltRequest {
  headerEntries: Array<[string, string]>;
}

export function buildHttpRequest(draft: HttpRequestDraft, options: HttpRequestBuildOptions = {}): HttpBuiltRequest {
  return coreBuildHttpRequest(draft, options) as HttpBuiltRequest;
}

export function resolveHttpRequestDraftVariables(draft: HttpRequestDraft, variables: HttpVariables): HttpRequestDraft {
  return coreResolveHttpRequestDraftVariables(draft, variables) as HttpRequestDraft;
}

export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: Array<[string, string]> }): HttpRequestDraft {
  return coreRequestDraftFromBuiltRequest(request) as HttpRequestDraft;
}
