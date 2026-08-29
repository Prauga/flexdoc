import { FlexDocOptions } from './interfaces';

interface OpenAPISpec {
  info?: { title?: string; description?: string; version?: string };
  [key: string]: unknown;
}

interface RenderOptions extends FlexDocOptions { specUrl?: string; rendererBasePath?: string; }

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Produce the small, language-neutral host page used by server-side adapters. */
export function generateFlexDocHTML(spec: OpenAPISpec | null, options: RenderOptions = {}): string {
  const {
    title,
    description,
    version,
    customCss = '',
    customJs = '',
    favicon = '',
    specUrl,
    rendererBasePath = './__flexdoc',
    // Route auth is intentionally consumed server-side and must never be
    // serialized into window.__FLEXDOC_OPTIONS__.
    auth: _serverOnlyAuth,
    ...rendererOptions
  } = options;

  const documentTitle = title || spec?.info?.title || 'API Documentation';
  const publicOptions = {
    contractVersion: '1',
    ...rendererOptions,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(documentTitle)}</title>
  ${favicon ? `<link rel="icon" href="${escapeHtml(favicon)}" />` : ''}
  <link rel="stylesheet" href="${escapeHtml(rendererBasePath)}/renderer.css" />
  ${customCss ? `<style>${customCss}</style>` : ''}
</head>
<body>
  <div id="flexdoc-root"></div>
  <script>
    window.__FLEXDOC_SPEC__ = ${serializeForScript(spec)};
    window.__FLEXDOC_SPEC_URL__ = ${serializeForScript(specUrl || null)};
    window.__FLEXDOC_OPTIONS__ = ${serializeForScript(publicOptions)};
  </script>
  <script src="${escapeHtml(rendererBasePath)}/renderer.js"></script>
  <script>
    (async function bootstrapFlexDoc() {
      const root = document.getElementById('flexdoc-root');
      try {
        let spec = window.__FLEXDOC_SPEC__;
        if (!spec && window.__FLEXDOC_SPEC_URL__) {
          const response = await fetch(window.__FLEXDOC_SPEC_URL__);
          if (!response.ok) throw new Error('Unable to load OpenAPI specification: HTTP ' + response.status);
          spec = await response.json();
        }
        if (!spec) throw new Error('No OpenAPI specification was provided');
        if (!window.FlexDocStandalone?.mount) throw new Error('FlexDoc renderer failed to load');
        window.FlexDocStandalone.mount(root, { spec, options: window.__FLEXDOC_OPTIONS__ || {} });
      } catch (error) {
        root.innerHTML = '<pre style="padding:24px;color:#b91c1c;white-space:pre-wrap"></pre>';
        root.firstChild.textContent = error instanceof Error ? error.message : String(error);
      }
    })();
  </script>
  ${customJs ? `<script>${customJs}</script>` : ''}
</body>
</html>`;
}
