import {
  buildHttpRequest as coreBuildHttpRequest,
  inferHttpBodyMode as coreInferHttpBodyMode,
  requestDraftFromBuiltRequest as coreRequestDraftFromBuiltRequest,
  resolveHttpRequestDraftVariables as coreResolveHttpRequestDraftVariables,
} from '../../../../core/dist/http-client.js';
import type { BuiltRequest } from './request-builder';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpBodyMode = 'none' | 'raw' | 'json' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';
export interface HttpFormDataEntry extends HttpKeyValue { type?: 'text' | 'file'; file?: File; fileName?: string; contentType?: string; }
export interface HttpGraphqlBody { query: string; variables: string; }
export interface HttpBinaryBody { file?: File; fileName?: string; contentType?: string; }

export type HttpOAuth2GrantType = 'accessToken' | 'authorizationCode' | 'clientCredentials' | 'password' | 'implicit';

export interface HttpOAuth2Auth {
  type: 'oauth2';
  accessToken: string;
  grantType?: HttpOAuth2GrantType;
  authorizationUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientAuthentication?: 'body' | 'basic';
  redirectUri?: string;
  scopes?: string[];
  username?: string;
  password?: string;
  refreshToken?: string;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'bearer'; token: string }
  | HttpOAuth2Auth
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; in: 'header' | 'query' };

export interface HttpRequestDraft {
  method: string;
  url: string;
  query?: HttpKeyValue[];
  headers?: HttpKeyValue[];
  body?: string;
  contentType?: string;
  bodyMode?: HttpBodyMode;
  urlencoded?: HttpKeyValue[];
  formData?: HttpFormDataEntry[];
  binary?: HttpBinaryBody;
  graphql?: HttpGraphqlBody;
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

export function inferHttpBodyMode(draft: Partial<HttpRequestDraft>): HttpBodyMode {
  return coreInferHttpBodyMode(draft) as HttpBodyMode;
}

export function resolveHttpRequestDraftVariables(draft: HttpRequestDraft, variables: HttpVariables): HttpRequestDraft {
  return coreResolveHttpRequestDraftVariables(draft, variables) as HttpRequestDraft;
}

export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: Array<[string, string]> }): HttpRequestDraft {
  return coreRequestDraftFromBuiltRequest(request) as HttpRequestDraft;
}
