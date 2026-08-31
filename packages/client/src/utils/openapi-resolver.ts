import type { OpenAPISpec } from '../types/openapi';
import {
  bundleExternalReferences as coreBundleExternalReferences,
  EXTERNAL_DOCUMENTS_KEY as CORE_EXTERNAL_DOCUMENTS_KEY,
} from '../../../../core/dist/openapi-resolver.js';

export type DocumentLoader = (uri: string) => Promise<unknown>;
export interface BundleOptions { baseUri: string; load?: DocumentLoader; }

// Keep the client declaration surface self-contained. Re-exporting the imported
// binding directly makes TypeScript emit the monorepo-only core/dist path into
// the published client .d.ts files.
export const EXTERNAL_DOCUMENTS_KEY: string = CORE_EXTERNAL_DOCUMENTS_KEY;

export async function bundleExternalReferences(spec: OpenAPISpec, options: BundleOptions): Promise<OpenAPISpec> {
  return coreBundleExternalReferences(spec, options) as Promise<OpenAPISpec>;
}
