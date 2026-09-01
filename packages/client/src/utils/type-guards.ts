import { Reference, RequestBody } from '../types/openapi';

export function isReference(obj: unknown): obj is Reference {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }
  return '$ref' in obj;
}

export function isRequestBody(
  obj: RequestBody | Reference
): obj is RequestBody {
  if (obj === null || obj === undefined) {
    return false;
  }
  return typeof obj === 'object' && !isReference(obj);
}
