import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FlexDoc } from './components/FlexDoc';
import { OpenAPISpec } from './types/openapi';
import './styles.css';

export interface StandaloneFlexDocOptions {
  theme?: 'light' | 'dark' | Record<string, unknown>;
  title?: string;
  description?: string;
  version?: string;
  tagGroups?: Array<{ name: string; tags: string[] }>;
}

export interface StandaloneFlexDocConfig {
  spec: OpenAPISpec;
  options?: StandaloneFlexDocOptions;
}

const roots = new WeakMap<Element, Root>();

function cloneSpec(spec: OpenAPISpec): OpenAPISpec {
  return JSON.parse(JSON.stringify(spec)) as OpenAPISpec;
}

/**
 * Prepare a view-only OpenAPI document without mutating the caller's spec.
 *
 * Tag groups intentionally filter only paths. Components are retained so
 * recursive and transitive schema references remain valid. The renderer can
 * prune components later with a proper reference graph if bundle size ever
 * makes that worthwhile.
 */
export function prepareSpec(
  source: OpenAPISpec,
  options: StandaloneFlexDocOptions = {}
): OpenAPISpec {
  const spec = cloneSpec(source);

  if (options.title) spec.info.title = options.title;
  if (options.description) spec.info.description = options.description;
  if (options.version) spec.info.version = options.version;

  if (!options.tagGroups?.length) return spec;

  const tagToGroup = new Map<string, string>();
  for (const group of options.tagGroups) {
    for (const tag of group.tags) tagToGroup.set(tag, group.name);
  }

  const paths: OpenAPISpec['paths'] = {};
  const methods = new Set([
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ]);

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const nextPathItem: typeof pathItem = {};
    let includedOperation = false;

    for (const [key, value] of Object.entries(pathItem)) {
      if (!methods.has(key)) {
        (nextPathItem as Record<string, unknown>)[key] = value;
        continue;
      }

      const operation = value as { tags?: string[] } | undefined;
      const groupedTags = (operation?.tags || [])
        .filter((tag) => tagToGroup.has(tag))
        .map((tag) => tagToGroup.get(tag) as string);

      if (!groupedTags.length || !operation) continue;

      (nextPathItem as Record<string, unknown>)[key] = {
        ...operation,
        tags: Array.from(new Set(groupedTags)),
      };
      includedOperation = true;
    }

    if (includedOperation) paths[path] = nextPathItem;
  }

  spec.paths = paths;
  spec.tags = options.tagGroups.map((group) => ({ name: group.name }));
  return spec;
}

export function mountFlexDoc(
  element: Element,
  config: StandaloneFlexDocConfig
): () => void {
  const options = config.options || {};
  const spec = prepareSpec(config.spec, options);
  const theme = typeof options.theme === 'string' ? options.theme : 'light';

  const existingRoot = roots.get(element);
  if (existingRoot) existingRoot.unmount();

  const root = createRoot(element);
  roots.set(element, root);
  root.render(<FlexDoc spec={spec} theme={theme} />);

  return () => {
    if (roots.get(element) === root) roots.delete(element);
    root.unmount();
  };
}

declare global {
  interface Window {
    FlexDocStandalone?: {
      mount: typeof mountFlexDoc;
      prepareSpec: typeof prepareSpec;
    };
  }
}

if (typeof window !== 'undefined') {
  window.FlexDocStandalone = {
    mount: mountFlexDoc,
    prepareSpec,
  };
}
