import { Reference, RequestBody } from '../types/openapi';

export function isReference(obj: any): obj is Reference {
  return obj && typeof obj === 'object' && '$ref' in obj;
}

export function isRequestBody(
  obj: RequestBody | Reference
): obj is RequestBody {
  return obj && typeof obj === 'object' && !isReference(obj);
}

