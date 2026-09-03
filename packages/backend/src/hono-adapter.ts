import { authorizeFlexDocRequest } from './auth';
import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { generateFlexDocHTML } from './template';

export interface HonoLikeRequest {
  header(name: string): string | undefined;
}

export interface HonoLikeContext {
  req: HonoLikeRequest;
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
  const auth = options.options?.auth;

  const denyUnauthorized = (context: HonoLikeContext): unknown | undefined => {
    if (!auth) return undefined;
    const decision = authorizeFlexDocRequest(context.req.header('Authorization'), auth);
    if (decision.authorized) return undefined;

    return context.body(decision.message || 'Authentication required', 401, {
      'Content-Type': 'text/plain; charset=utf-8',
      ...(decision.challenge ? { 'WWW-Authenticate': decision.challenge } : {}),
    });
  };

  const page = (context: HonoLikeContext) => {
    const denied = denyUnauthorized(context);
    if (denied !== undefined) return denied;

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
    const denied = denyUnauthorized(context);
    if (denied !== undefined) return denied;

    const assets = getRendererAssets();
    return context.body(assets.javascript, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });
  app.get(`${rendererBasePath}/renderer.css`, (context) => {
    const denied = denyUnauthorized(context);
    if (denied !== undefined) return denied;

    const assets = getRendererAssets();
    return context.body(assets.css, 200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });
}
