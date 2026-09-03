import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { generateFlexDocHTML } from './template';

export interface HonoLikeContext {
  body(body: string | Uint8Array, status?: number, headers?: Record<string, string>): unknown;
}

export interface HonoLikeApplication {
  get(path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>): unknown;
}

/** Register FlexDoc on Hono without adding Hono as a backend package dependency. */
export function setupHonoFlexDoc(
  app: HonoLikeApplication,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>,
): void {
  const normalizedPath = `/${path.trim().replace(/^\/+|\/+$/g, '')}` || '/docs';
  const base = normalizedPath === '/' ? '/docs' : normalizedPath;
  const rendererBasePath = `${base}/__flexdoc`;

  const page = (context: HonoLikeContext) => {
    const assets = getRendererAssets();
    const spec = (options.spec || null) as Parameters<typeof generateFlexDocHTML>[0];
    const html = generateFlexDocHTML(spec, {
      ...(options.options || {}),
      specUrl: options.specUrl,
      rendererBasePath,
      rendererVersion: assets.version,
    });
    return context.body(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
  };

  app.get(base, page);
  app.get(`${base}/`, page);
  app.get(`${rendererBasePath}/renderer.js`, (context) => {
    const assets = getRendererAssets();
    return context.body(assets.javascript, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });
  app.get(`${rendererBasePath}/renderer.css`, (context) => {
    const assets = getRendererAssets();
    return context.body(assets.css, 200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });
}
