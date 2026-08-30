import type { OpenAPISpec } from '../types/openapi';
import { bundleExternalReferences as coreBundleExternalReferences, EXTERNAL_DOCUMENTS_KEY } from '../../../core/src/openapi-resolver';

export type DocumentLoader = (uri: string) => Promise<unknown>;
export interface BundleOptions { baseUri: string; load?: DocumentLoader; }

export async function bundleExternalReferences(spec: OpenAPISpec, options: BundleOptions): Promise<OpenAPISpec> {
  return coreBundleExternalReferences(spec, options) as Promise<OpenAPISpec>;
}

export { EXTERNAL_DOCUMENTS_KEY };
