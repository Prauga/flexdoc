import { authorizeFlexDocRequest } from './auth';
import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { generateFlexDocHTML } from './template';
import { createHostExecutionState, publicHostExecutionOptions } from './host-execution';
import { runHostCookiesRoute, runHostExecutionRoute } from './host-execution-route';

export interface HonoLikeRequest {
  header(name: string): string | undefined;
  raw?: Request;
}

export interface HonoLikeContext {
  req: HonoLikeRequest;
  body(body: string | Uint8Array, status?: number, headers?: Record<string, string>): unknown;
}

export interface HonoLikeApplication {
  get(path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>): unknown;
  post?: (path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>) => unknown;
  delete?: (path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>) => unknown;
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
  const hostExecutionState = createHostExecutionState(options.options?.tryIt?.hostExecution);
  const hostRouteAvailable = hostExecutionState.enabled && typeof app.post === 'function';
  let remoteSpecPromise: Promise<unknown> | undefined;
  const resolvedSpec = async () => {
    if (options.spec) return options.spec;
    if (!options.specUrl) return null;
    if (!remoteSpecPromise) remoteSpecPromise = fetch(options.specUrl, { signal: AbortSignal.timeout(10_000) }).then(async (response) => { if (!response.ok) throw new Error(`Failed to load OpenAPI spec: HTTP ${response.status}`); return response.json(); }).catch((error) => { remoteSpecPromise = undefined; throw error; });
    return remoteSpecPromise;
  };

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
      hostExecutionPublic: hostRouteAvailable ? publicHostExecutionOptions(hostExecutionState, rendererBasePath) : undefined,
    });
    return context.body(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
  };

  const honoHeaders = (context: HonoLikeContext) => ({
    'authorization': context.req.header('Authorization'),
    'content-type': context.req.header('Content-Type'),
    'cookie': context.req.header('Cookie'),
    'x-flexdoc-execute': context.req.header('X-FlexDoc-Execute'),
  });
  const sendHostResult = (context: HonoLikeContext, result: { status: number; headers: Record<string, string>; body: string }) => context.body(result.body, result.status, result.headers);
  if (hostRouteAvailable) {
    app.post?.(`${rendererBasePath}/execute`, async (context) => {
      const denied = denyUnauthorized(context);
      if (denied !== undefined) return denied;
      if (!context.req.raw) return context.body(JSON.stringify({ error: 'Hono Request body is unavailable.' }), 500, { 'Content-Type': 'application/json; charset=utf-8' });
      const body = Buffer.from(await context.req.raw.arrayBuffer());
      return sendHostResult(context, await runHostExecutionRoute({ state: hostExecutionState, spec: await resolvedSpec(), headers: honoHeaders(context), body }));
    });
    app.get(`${rendererBasePath}/cookies`, (context) => {
      const denied = denyUnauthorized(context);
      if (denied !== undefined) return denied;
      return sendHostResult(context, runHostCookiesRoute({ state: hostExecutionState, headers: honoHeaders(context) }));
    });
    app.delete?.(`${rendererBasePath}/cookies`, (context) => {
      const denied = denyUnauthorized(context);
      if (denied !== undefined) return denied;
      return sendHostResult(context, runHostCookiesRoute({ state: hostExecutionState, headers: honoHeaders(context), clear: true }));
    });
  }

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
