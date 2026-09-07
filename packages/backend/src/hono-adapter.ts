import { authorizeFlexDocRequest } from './auth';
import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { generateFlexDocHTML } from './template';
import { createHostExecutionState, publicHostExecutionOptions } from './host-execution';
import { hostExecutionRequestOrigin, runHostCookiesRoute, runHostExecutionRoute } from './host-execution-route';
import { createCachedFlexDocPage, matchesFlexDocEtag } from './page-cache';
import { buildRuntimeIntelligenceSnapshot, discoverHonoRoutes, runtimeIntelligenceEnabled } from './runtime-intelligence';

/** Minimal Hono request surface required by FlexDoc's adapter. */
export interface HonoLikeRequest {
  /** Read one incoming request header by name. */ header(name: string): string | undefined;
  /** Native Fetch `Request` when exposed by the Hono runtime. */ raw?: Request;
}

/** Minimal Hono context surface required by FlexDoc's adapter. */
export interface HonoLikeContext {
  /** Incoming Hono request wrapper. */ req: HonoLikeRequest;
  /** Create a response from body text/bytes, status, and headers. */
  body(body: string | Uint8Array, status?: number, headers?: Record<string, string>): unknown;
}

/** Minimal Hono application surface required by `setupHonoFlexDoc`. */
export interface HonoLikeApplication {
  /** Register a GET route. */
  get(path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>): unknown;
  /** Register a POST route when supported by the host. Required for API-host execution. */
  post?: (path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>) => unknown;
  /** Register a DELETE route when supported by the host. Used to clear host cookies. */
  delete?: (path: string, handler: (context: HonoLikeContext) => unknown | Promise<unknown>) => unknown;
  /** Hono's registered route list used by Runtime Intelligence discovery. */
  routes?: Array<{ method: string; path: string }>;
}

/**
 * Register FlexDoc on Hono without adding Hono as a backend package dependency.
 * @param app Hono-compatible application instance.
 * @param path Documentation mount path.
 * @param options Inline/remote OpenAPI source plus renderer, auth, Runtime Intelligence, and Try It options.
 */
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
  const runtimeEnabled = runtimeIntelligenceEnabled(options.options?.runtimeIntelligence);
  const runtimeEndpoint = `${rendererBasePath}/runtime`;
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

  const getPage = createCachedFlexDocPage(() => {
    const assets = getRendererAssets();
    const spec = (options.spec || null) as Parameters<typeof generateFlexDocHTML>[0];
    return generateFlexDocHTML(spec, {
      ...(options.options || {}),
      specUrl: options.specUrl,
      rendererBasePath,
      rendererVersion: assets.version,
      hostExecutionPublic: hostRouteAvailable ? publicHostExecutionOptions(hostExecutionState, rendererBasePath) : undefined,
      runtimeIntelligencePublic: runtimeEnabled ? { available: true, endpoint: runtimeEndpoint, framework: 'hono' } : undefined,
    });
  });

  const page = async (context: HonoLikeContext) => {
    const denied = denyUnauthorized(context);
    if (denied !== undefined) return denied;

    const cachedPage = await getPage();
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'ETag': cachedPage.etag,
    };
    if (matchesFlexDocEtag(context.req.header('If-None-Match'), cachedPage.etag)) {
      return context.body('', 304, headers);
    }
    return context.body(cachedPage.body, 200, headers);
  };

  const honoHeaders = (context: HonoLikeContext) => ({
    'authorization': context.req.header('Authorization'),
    'content-type': context.req.header('Content-Type'),
    'cookie': context.req.header('Cookie'),
    'host': context.req.header('Host'),
    'x-flexdoc-execute': context.req.header('X-FlexDoc-Execute'),
  });
  const sendHostResult = (context: HonoLikeContext, result: { status: number; headers: Record<string, string>; body: string }) => context.body(result.body, result.status, result.headers);

  if (runtimeEnabled) {
    app.get(runtimeEndpoint, async (context) => {
      const denied = denyUnauthorized(context);
      if (denied !== undefined) return denied;
      const headers = honoHeaders(context);
      const serverOrigin = hostExecutionRequestOrigin({ headers, url: context.req.raw?.url });
      const snapshot = buildRuntimeIntelligenceSnapshot({
        spec: await resolvedSpec(),
        discovery: discoverHonoRoutes(app, base),
        serverOrigin,
      });
      return context.body(JSON.stringify(snapshot), 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    });
  }

  if (hostRouteAvailable) {
    app.post?.(`${rendererBasePath}/execute`, async (context) => {
      const denied = denyUnauthorized(context);
      if (denied !== undefined) return denied;
      if (!context.req.raw) return context.body(JSON.stringify({ error: 'Hono Request body is unavailable.' }), 500, { 'Content-Type': 'application/json; charset=utf-8' });
      const body = Buffer.from(await context.req.raw.arrayBuffer());
      const headers = honoHeaders(context);
      const docsOrigin = hostExecutionRequestOrigin({ headers, url: context.req.raw.url });
      return sendHostResult(context, await runHostExecutionRoute({ state: hostExecutionState, spec: await resolvedSpec(), headers, body, docsOrigin }));
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
