import { createRoot, Root } from 'react-dom/client';
import { FlexDoc } from './components/FlexDoc';
import { ApiClientWorkspace } from './components/ApiClientWorkspace';
import type { ApiClientWorkspaceProps } from './components/ApiClientWorkspace';
import { OpenAPISpec } from './types/openapi';
import { FlexDocRendererOptions } from './types/options';
import { bundleExternalReferences, DocumentLoader } from './utils/openapi-resolver';
import './styles.css';

/** Renderer options accepted by the standalone browser mount API. */
export type StandaloneFlexDocOptions = FlexDocRendererOptions;
/** API Client workspace props accepted by the standalone browser mount API. */
export type StandaloneApiClientConfig = ApiClientWorkspaceProps;

/** Configuration for mounting the standalone documentation renderer. */
export interface StandaloneFlexDocConfig {
  /** Parsed OpenAPI document to render. */
  spec: OpenAPISpec;
  /** Renderer options applied to the mounted documentation. */
  options?: StandaloneFlexDocOptions;
  /** Absolute URI used to resolve relative external `$ref` values before async mounting. */
  baseUri?: string;
  /** Optional loader for external reference documents. */
  documentLoader?: DocumentLoader;
}

/** Renderer-host compatibility contract implemented by this standalone bundle. */
export const FLEXDOC_CONTRACT_VERSION = '1' as const;
const roots = new WeakMap<Element, Root>();

function cloneSpec(spec: OpenAPISpec): OpenAPISpec {
  return JSON.parse(JSON.stringify(spec)) as OpenAPISpec;
}

/**
 * Clone and apply renderer metadata/tag-group overrides to an OpenAPI document.
 * @param source Source OpenAPI document; the input object is never mutated.
 * @param options Renderer options containing optional metadata/tag-group overrides.
 * @returns Prepared OpenAPI document passed to the React renderer.
 */
export function prepareSpec(source: OpenAPISpec, options: StandaloneFlexDocOptions = {}): OpenAPISpec {
  const spec = cloneSpec(source);
  if (options.title) spec.info.title = options.title;
  if (options.description) spec.info.description = options.description;
  if (options.altDescription && !spec.info.description) spec.info.description = options.altDescription;
  if (options.version) spec.info.version = options.version;
  if (!options.tagGroups?.length) return spec;

  const tagToGroup = new Map<string, string>();
  for (const group of options.tagGroups) for (const tag of group.tags) tagToGroup.set(tag, group.name);
  const paths: OpenAPISpec['paths'] = {};
  const methods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']);

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const nextPathItem: typeof pathItem = {};
    let includedOperation = false;
    for (const [key, value] of Object.entries(pathItem)) {
      if (!methods.has(key)) { (nextPathItem as Record<string, unknown>)[key] = value; continue; }
      const operation = value as { tags?: string[] } | undefined;
      const groupedTags = (operation?.tags || []).filter((tag) => tagToGroup.has(tag)).map((tag) => tagToGroup.get(tag) as string);
      if (!groupedTags.length || !operation) continue;
      (nextPathItem as Record<string, unknown>)[key] = { ...operation, tags: Array.from(new Set(groupedTags)) };
      includedOperation = true;
    }
    if (includedOperation) paths[path] = nextPathItem;
  }
  spec.paths = paths;
  spec.tags = options.tagGroups.map((group) => ({ name: group.name }));
  return spec;
}

function resolveTheme(options: StandaloneFlexDocOptions): 'light' | 'dark' {
  if (typeof options.theme === 'string') return options.theme;
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark';
  return 'light';
}

function renderFlexDoc(element: Element, source: OpenAPISpec, options: StandaloneFlexDocOptions): () => void {
  const spec = prepareSpec(source, options);
  const existingRoot = roots.get(element);
  if (existingRoot) existingRoot.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<FlexDoc spec={spec} theme={resolveTheme(options)} options={options} />);
  return () => { if (roots.get(element) === root) roots.delete(element); root.unmount(); };
}

/**
 * Mount FlexDoc synchronously into a DOM element using an already self-contained spec.
 * @param element DOM element that owns the React root.
 * @param config OpenAPI document and renderer options.
 * @returns Cleanup function that unmounts the React root.
 */
export function mountFlexDoc(element: Element, config: StandaloneFlexDocConfig): () => void {
  const options = { contractVersion: FLEXDOC_CONTRACT_VERSION, ...(config.options || {}) } as StandaloneFlexDocOptions;
  return renderFlexDoc(element, config.spec, options);
}

/**
 * Mount the full API Client workspace into a DOM element.
 * @param element DOM element that owns the React root.
 * @param config API Client workspace props.
 * @returns Cleanup function that unmounts the React root.
 */
export function mountApiClient(element: Element, config: StandaloneApiClientConfig = {}): () => void {
  const existingRoot = roots.get(element);
  if (existingRoot) existingRoot.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<ApiClientWorkspace {...config} />);
  return () => { if (roots.get(element) === root) roots.delete(element); root.unmount(); };
}

/**
 * Bundle external OpenAPI references, then mount FlexDoc into a DOM element.
 * @param element DOM element that owns the React root.
 * @param config OpenAPI document, optional base URI/loader, and renderer options.
 * @returns Promise resolving to a cleanup function that unmounts the React root.
 */
export async function mountFlexDocAsync(element: Element, config: StandaloneFlexDocConfig): Promise<() => void> {
  const options = { contractVersion: FLEXDOC_CONTRACT_VERSION, ...(config.options || {}) } as StandaloneFlexDocOptions;
  const spec = config.baseUri
    ? await bundleExternalReferences(config.spec, { baseUri: config.baseUri, load: config.documentLoader })
    : config.spec;
  return renderFlexDoc(element, spec, options);
}

declare global {
  interface Window {
    /** Global standalone mount API exposed by `flexdoc.standalone.js`. */
    FlexDocStandalone?: {
      /** Mount documentation synchronously from a self-contained spec. */ mount: typeof mountFlexDoc;
      /** Bundle external references then mount documentation. */ mountAsync: typeof mountFlexDocAsync;
      /** Mount the full API Client workspace. */ mountApiClient: typeof mountApiClient;
      /** Clone and apply renderer metadata/tag-group options to a spec. */ prepareSpec: typeof prepareSpec;
      /** Renderer-host compatibility contract version. */ contractVersion: typeof FLEXDOC_CONTRACT_VERSION;
    };
  }
}

if (typeof window !== 'undefined') window.FlexDocStandalone = {
  mount: mountFlexDoc,
  mountAsync: mountFlexDocAsync,
  mountApiClient,
  prepareSpec,
  contractVersion: FLEXDOC_CONTRACT_VERSION,
};
