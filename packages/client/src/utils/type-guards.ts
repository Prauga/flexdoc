import { Reference, RequestBody } from '../types/openapi';

export function isReference(obj: any): obj is Reference {
  if (obj === null || obj === undefined) {
    return false;
  }
  return typeof obj === 'object' && '$ref' in obj;
}

export function isRequestBody(
  obj: RequestBody | Reference
): obj is RequestBody {
  if (obj === null || obj === undefined) {
    return false;
  }
  return typeof obj === 'object' && !isReference(obj);
}

