import {
  buildHttpRequest as coreBuildHttpRequest,
  requestDraftFromBuiltRequest as coreRequestDraftFromBuiltRequest,
} from '../../../../core/dist/http-client.js';
import type { BuiltRequest } from './request-builder';

export interface HttpKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type HttpAuth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
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

export interface HttpBuiltRequest extends BuiltRequest {
  headerEntries: Array<[string, string]>;
}

export function buildHttpRequest(draft: HttpRequestDraft): HttpBuiltRequest {
  return coreBuildHttpRequest(draft) as HttpBuiltRequest;
}

export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: Array<[string, string]> }): HttpRequestDraft {
  return coreRequestDraftFromBuiltRequest(request) as HttpRequestDraft;
}
