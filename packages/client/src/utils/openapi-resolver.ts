import { OpenAPISpec } from '../types/openapi';
import { OpenAPIParser } from './openapi-parser';

export type DocumentLoader = (uri: string) => Promise<unknown>;

export interface BundleOptions {
  baseUri: string;
  load?: DocumentLoader;
}

const EXTERNAL_DOCUMENTS_KEY = 'x-flexdoc-external-documents';

function defaultLoader(uri: string): Promise<unknown> {
  if (typeof fetch !== 'function') throw new Error('No document loader is available in this environment');
  return fetch(uri).then(async (response) => {
    if (!response.ok) throw new Error(`Failed to load OpenAPI reference ${uri}: ${response.status}`);
    const text = await response.text();
    return OpenAPIParser.parseSpec(text).catch(() => {
      try { return JSON.parse(text); } catch { throw new Error(`Reference document is not valid JSON/YAML: ${uri}`); }
    });
  });
}

function splitReference(ref: string, fromUri: string): { documentUri: string; pointer: string } {
  if (ref.startsWith('#')) return { documentUri: fromUri, pointer: ref };
  const url = new URL(ref, fromUri);
  const pointer = url.hash || '#';
  url.hash = '';
  return { documentUri: url.toString(), pointer };
}

function externalPointer(documentUri: string, pointer: string): string {
  const key = OpenAPIParser.encodePointerToken(documentUri);
  if (pointer === '#' || pointer === '') return `#/${EXTERNAL_DOCUMENTS_KEY}/${key}`;
  if (!pointer.startsWith('#/')) throw new Error(`Unsupported JSON Pointer reference: ${pointer}`);
  return `#/${EXTERNAL_DOCUMENTS_KEY}/${key}/${pointer.slice(2)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Bundles external OpenAPI references into a root extension and rewrites all
 * references to local JSON Pointers. The resulting document stays JSON-safe,
 * including circular schemas, because references remain references.
 */
export async function bundleExternalReferences(spec: OpenAPISpec, options: BundleOptions): Promise<OpenAPISpec> {
  const load = options.load || defaultLoader;
  const rootUri = new URL(options.baseUri).toString().replace(/#.*$/, '');
  const root = clone(spec) as OpenAPISpec & Record<string, any>;
  const externalDocuments: Record<string, any> = {};
  const loading = new Map<string, Promise<any>>();

  async function getDocument(uri: string): Promise<any> {
    if (uri === rootUri) return root;
    if (externalDocuments[uri]) return externalDocuments[uri];
    if (loading.has(uri)) return loading.get(uri)!;
    const pending = Promise.resolve(load(uri)).then((doc) => clone(doc));
    loading.set(uri, pending);
    const doc = await pending;
    externalDocuments[uri] = doc;
    return doc;
  }

  const visited = new Set<string>();
  async function rewriteDocument(document: any, documentUri: string): Promise<void> {
    if (visited.has(documentUri)) return;
    visited.add(documentUri);

    async function walk(node: any): Promise<void> {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) await walk(item);
        return;
      }
      if (typeof node.$ref === 'string') {
        const target = splitReference(node.$ref, documentUri);
        if (target.documentUri !== documentUri) {
          const targetDoc = await getDocument(target.documentUri);
          node.$ref = target.documentUri === rootUri
            ? target.pointer
            : externalPointer(target.documentUri, target.pointer);
          await rewriteDocument(targetDoc, target.documentUri);
        } else if (documentUri !== rootUri) {
          node.$ref = externalPointer(documentUri, target.pointer);
        }
      }
      for (const [key, value] of Object.entries(node)) {
        if (key !== '$ref') await walk(value);
      }
    }

    await walk(document);
  }

  await rewriteDocument(root, rootUri);
  if (Object.keys(externalDocuments).length) root[EXTERNAL_DOCUMENTS_KEY] = externalDocuments;
  return root;
}

export { EXTERNAL_DOCUMENTS_KEY };
