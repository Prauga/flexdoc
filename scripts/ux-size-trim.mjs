import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, fn) {
  const before = readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  writeFileSync(path, after);
}
function once(source, from, to, label) {
  const i = source.indexOf(from);
  if (i < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, i + from.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, i) + to + source.slice(i + from.length);
}

for (const path of [
  'packages/client/src/utils/api-client-execution.ts',
  'packages/client/src/components/ApiClient.tsx',
  'packages/client/src/components/RequestPlayground.tsx',
  'packages/client/src/utils/api-client-execution.test.ts',
  'packages/client/src/components/ApiClient.host-execution-copy.test.tsx',
  'packages/client/src/components/RequestPlayground.test.tsx',
]) {
  edit(path, (source) => source
    .replaceAll('hostAvailable', 'available')
    .replaceAll('bodyNeedsHostTransport', 'bodyHost')
    .replaceAll('missingCapabilities', 'missing'));
}

edit('packages/client/src/standalone.tsx', (source) => {
  source = once(source,
    "import { createRoot, Root } from 'react-dom/client';",
    "import type { ReactNode } from 'react';\nimport { createRoot, Root } from 'react-dom/client';",
    'ReactNode import');
  source = once(source,
    "function renderFlexDoc(element: Element, source: OpenAPISpec, options: StandaloneFlexDocOptions): () => void {\n  const spec = prepareSpec(source, options);\n  const existingRoot = roots.get(element);\n  if (existingRoot) existingRoot.unmount();\n  const root = createRoot(element);\n  roots.set(element, root);\n  root.render(<FlexDoc spec={spec} theme={resolveTheme(options)} options={options} />);\n  return () => { if (roots.get(element) === root) roots.delete(element); root.unmount(); };\n}",
    "function mountRoot(element: Element, child: ReactNode): () => void {\n  const existingRoot = roots.get(element);\n  if (existingRoot) existingRoot.unmount();\n  const root = createRoot(element);\n  roots.set(element, root);\n  root.render(child);\n  return () => { if (roots.get(element) === root) roots.delete(element); root.unmount(); };\n}\n\nfunction renderFlexDoc(element: Element, source: OpenAPISpec, options: StandaloneFlexDocOptions): () => void {\n  return mountRoot(element, <FlexDoc spec={prepareSpec(source, options)} theme={resolveTheme(options)} options={options} />);\n}",
    'FlexDoc root lifecycle');
  source = once(source,
    "export function mountApiClient(element: Element, config: StandaloneApiClientConfig = {}): () => void {\n  const existingRoot = roots.get(element);\n  if (existingRoot) existingRoot.unmount();\n  const root = createRoot(element);\n  roots.set(element, root);\n  root.render(<ApiClientWorkspace {...config} />);\n  return () => { if (roots.get(element) === root) roots.delete(element); root.unmount(); };\n}",
    "export function mountApiClient(element: Element, config: StandaloneApiClientConfig = {}): () => void {\n  return mountRoot(element, <ApiClientWorkspace {...config} />);\n}",
    'API Client root lifecycle');
  return source;
});

console.log('Applied structural transport UX size trim.');
