import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { setupFlexDoc } from './setup';
import { generateFlexDocHTML } from './template';
import { createHostExecutionState, publicHostExecutionOptions } from './host-execution';
import { hostExecutionRequestOrigin, runHostCookiesRoute, runHostExecutionRoute } from './host-execution-route';
import { createCachedFlexDocPage, matchesFlexDocEtag } from './page-cache';
import { buildRuntimeIntelligenceSnapshot, discoverFastifyRoutes, runtimeIntelligenceEnabled } from './runtime-intelligence';

/** Minimal Express application surface required by `setupExpressFlexDoc`. */
export interface ExpressLikeApplication {
  /** Register a middleware/handler beneath the supplied path. */
  use(path: string, handler: (req: any, res: any, next?: any) => void | Promise<void>): void;
}

/** Minimal Fastify reply surface required by FlexDoc's adapter. */
export interface FastifyLikeReply {
  /** Set the outgoing HTTP status code. */ code(statusCode: number): FastifyLikeReply;
  /** Set the outgoing Content-Type header. */ type(contentType: string): FastifyLikeReply;
  /** Set one outgoing response header. */ header(name: string, value: string): FastifyLikeReply;
  /** Send the response payload. */ send(payload: any): any;
}

/** Minimal Fastify request surface required by FlexDoc's adapter. */
export interface FastifyLikeRequest {
  /** Incoming request headers. */ headers: Record<string, string | string[] | undefined>;
  /** Parsed request body when available. */ body?: unknown;
  /** Request protocol reported by Fastify. */ protocol?: string;
  /** Raw socket metadata used to infer HTTPS when protocol metadata is unavailable. */ raw?: { socket?: { encrypted?: boolean } };
}

/** Minimal Fastify application surface required by FlexDoc's adapter. */
export interface FastifyLikeApplication {
  /** Register a GET route. */
  get(path: string, options: Record<string, unknown>, handler: (req: FastifyLikeRequest, reply: FastifyLikeReply) => any | Promise<any>): void;
  /** Register a POST route when supported by the host. Required for API-host execution. */
  post?: (path: string, options: Record<string, unknown>, handler: (req: FastifyLikeRequest, reply: FastifyLikeReply) => any | Promise<any>) => void;
  /** Register a DELETE route when supported by the host. Used to clear host cookies. */
  delete?: (path: string, options: Record<string, unknown>, handler: (req: FastifyLikeRequest, reply: FastifyLikeReply) => any | Promise<any>) => void;
  /** Register a content-type parser used for multipart host-execution envelopes. */
  addContentTypeParser?: (contentType: string, options: { parseAs: 'buffer' }, parser: (request: unknown, body: Buffer, done: (error: Error | null, value?: unknown) => void) => void) => void;
  /** Test whether a content-type parser is already registered. */
  hasContentTypeParser?: (contentType: string) => boolean;
  /** Wait until Fastify and registered plugins are ready. */
  ready?: () => Promise<unknown>;
  /** Return the OpenAPI document produced by `@fastify/swagger`. */
  swagger?: () => Record<string, unknown>;
  /** Return Fastify's printable route tree for Runtime Intelligence discovery. */
  printRoutes?: (options?: Record<string, unknown>) => string;
  /** Fastify framework version when exposed by the application. */
  version?: string;
}

/** Minimal NestJS application surface required by `setupNestFlexDoc`. */
export interface NestLikeApplication {
  /** Return the NestJS HTTP adapter and its underlying Express/Fastify instance. */
  getHttpAdapter(): { getType?: () => string; getInstance: () => any };
}

/**
 * Register FlexDoc on an Express application.
 * @param app Express-compatible application instance.
 * @param path Documentation mount path.
 * @param options Inline/remote OpenAPI source and FlexDoc options.
 */
export function setupExpressFlexDoc(app: ExpressLikeApplication, path: string, options: Omit<FlexDocModuleOptions, 'path'>): void {
  setupFlexDoc(app, path, options);
}

function generatedPassword(username: string, secret: string): string {
  const hash = crypto.createHmac('sha256', secret).update(username).digest('base64').substring(0, 12);
  let password = hash;
  if (!/[A-Z]/.test(password)) password += 'A';
  if (!/[a-z]/.test(password)) password += 'a';
  if (!/[0-9]/.test(password)) password += '1';
  if (!/[^A-Za-z0-9]/.test(password)) password += '!';
  return password;
}

function authorize(headers: FastifyLikeRequest['headers'], auth?: { secretKey: string; type: 'basic' | 'bearer' }): boolean {
  if (!auth) return true;
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  if (auth.type === 'basic') {
    if (!value.startsWith('Basic ')) return false;
    const decoded = Buffer.from(value.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const username = separator < 0 ? decoded : decoded.slice(0, separator);
    const password = separator < 0 ? '' : decoded.slice(separator + 1);
    return password === generatedPassword(username, auth.secretKey);
  }
  let token: string | undefined;
  if (value.startsWith('Bearer ')) token = value.slice(7);
  else if (value.startsWith('Basic ')) {
    const decoded = Buffer.from(value.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator >= 0) token = decoded.slice(separator + 1);
  }
  if (!token) return false;
  try { jwt.verify(token, auth.secretKey); return true; } catch { return false; }
}

async function loadRemoteSpec(url: string): Promise<any> {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Failed to load OpenAPI spec: HTTP ${response.status}`);
  return response.json();
}

function setupFastifyFlexDocInternal(
  app: FastifyLikeApplication,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>,
  specProvider?: () => Promise<any> | any,
): void {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const rendererBasePath = `${normalizedPath}/__flexdoc`;
  const auth = options.options?.auth;
  const hostExecutionState = createHostExecutionState(options.options?.tryIt?.hostExecution);
  const hostRouteAvailable = hostExecutionState.enabled && typeof app.post === 'function';
  const runtimeEnabled = runtimeIntelligenceEnabled(options.options?.runtimeIntelligence);
  const runtimeEndpoint = `${rendererBasePath}/runtime`;
  let remoteSpecPromise: Promise<any> | null = null;
  let generatedSpecPromise: Promise<any> | null = null;

  const routeOptions = auth ? {
    preHandler: async (request: FastifyLikeRequest, reply: FastifyLikeReply) => {
      if (!authorize(request.headers, auth)) {
        reply.header('WWW-Authenticate', auth.type === 'basic' ? 'Basic' : 'Bearer');
        return reply.code(401).send('Authentication required');
      }
    },
  } : {};

  const resolvedSpec = async () => {
    if (specProvider) {
      if (!generatedSpecPromise) generatedSpecPromise = Promise.resolve(specProvider()).catch((error) => {
        generatedSpecPromise = null;
        throw error;
      });
      return generatedSpecPromise;
    }
    if (options.spec) return options.spec;
    if (!options.specUrl) return null;
    if (!remoteSpecPromise) remoteSpecPromise = loadRemoteSpec(options.specUrl).catch((error) => {
      remoteSpecPromise = null;
      throw error;
    });
    return remoteSpecPromise;
  };

  const getPage = createCachedFlexDocPage(async () => {
    const assets = getRendererAssets();
    return generateFlexDocHTML(await resolvedSpec(), {
      ...(options.options || {}),
      rendererBasePath,
      rendererVersion: assets.version,
      hostExecutionPublic: hostRouteAvailable ? publicHostExecutionOptions(hostExecutionState, rendererBasePath) : undefined,
      runtimeIntelligencePublic: runtimeEnabled ? { available: true, endpoint: runtimeEndpoint, framework: 'fastify' } : undefined,
    });
  });

  const sendHostResult = (reply: FastifyLikeReply, result: { status: number; headers: Record<string, string>; body: string }) => {
    let target = reply.code(result.status);
    for (const [name, value] of Object.entries(result.headers)) target = target.header(name, value);
    return target.send(result.body);
  };

  if (runtimeEnabled) {
    app.get(runtimeEndpoint, routeOptions, async (request, reply) => {
      const serverOrigin = hostExecutionRequestOrigin({
        headers: request.headers,
        protocol: request.protocol || (request.raw?.socket?.encrypted ? 'https' : 'http'),
      });
      const snapshot = buildRuntimeIntelligenceSnapshot({
        spec: await resolvedSpec(),
        discovery: await discoverFastifyRoutes(app, normalizedPath),
        serverOrigin,
      });
      return reply
        .type('application/json; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(JSON.stringify(snapshot));
    });
  }

  if (hostRouteAvailable) {
    if (app.addContentTypeParser && !app.hasContentTypeParser?.('multipart/form-data')) {
      app.addContentTypeParser('multipart/form-data', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    }
    app.post?.(`${rendererBasePath}/execute`, routeOptions, async (request, reply) => {
      const docsOrigin = hostExecutionRequestOrigin({
        headers: request.headers,
        protocol: request.protocol || (request.raw?.socket?.encrypted ? 'https' : 'http'),
      });
      return sendHostResult(reply, await runHostExecutionRoute({ state: hostExecutionState, spec: await resolvedSpec(), headers: request.headers, body: request.body, docsOrigin }));
    });
    app.get(`${rendererBasePath}/cookies`, routeOptions, async (request, reply) => sendHostResult(reply, runHostCookiesRoute({ state: hostExecutionState, headers: request.headers })));
    app.delete?.(`${rendererBasePath}/cookies`, routeOptions, async (request, reply) => sendHostResult(reply, runHostCookiesRoute({ state: hostExecutionState, headers: request.headers, clear: true })));
  }

  app.get(`${rendererBasePath}/renderer.js`, routeOptions, async (_request, reply) => {
    const assets = getRendererAssets();
    return reply.type('application/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=31536000, immutable').send(assets.javascript);
  });

  app.get(`${rendererBasePath}/renderer.css`, routeOptions, async (_request, reply) => {
    const assets = getRendererAssets();
    return reply.type('text/css; charset=utf-8').header('Cache-Control', 'public, max-age=31536000, immutable').send(assets.css);
  });

  app.get(normalizedPath, routeOptions, async (request, reply) => {
    try {
      const page = await getPage();
      let target = reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-cache')
        .header('ETag', page.etag);
      if (matchesFlexDocEtag(request.headers['if-none-match'], page.etag)) {
        return target.code(304).send('');
      }
      return target.send(page.body);
    } catch (error) {
      return reply.code(502).type('text/plain; charset=utf-8').send(`Unable to load OpenAPI specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Register FlexDoc on a Fastify application with an inline or remote spec.
 * @param app Fastify-compatible application instance.
 * @param path Documentation mount path.
 * @param options Inline/remote OpenAPI source and FlexDoc options.
 */
export function setupFastifyFlexDoc(app: FastifyLikeApplication, path: string, options: Omit<FlexDocModuleOptions, 'path'>): void {
  setupFastifyFlexDocInternal(app, path, options);
}

/**
 * Use the OpenAPI document generated by `@fastify/swagger` from route schemas.
 * @param app Fastify application with `@fastify/swagger` registered.
 * @param path Documentation mount path.
 * @param options FlexDoc renderer/backend options; `spec` and `specUrl` are intentionally excluded.
 */
export function setupFastifySwaggerFlexDoc(
  app: FastifyLikeApplication,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path' | 'spec' | 'specUrl'> = {}
): void {
  setupFastifyFlexDocInternal(app, path, options, async () => {
    if (typeof app.ready === 'function') await app.ready();
    if (typeof app.swagger !== 'function') {
      throw new Error('setupFastifySwaggerFlexDoc requires @fastify/swagger to be registered before FlexDoc');
    }
    return app.swagger();
  });
}

/**
 * Convenience integration for NestJS applications using `@nestjs/swagger`.
 * `@nestjs/swagger` remains optional; it is only resolved when this helper is called.
 * @param app NestJS application backed by Express or Fastify.
 * @param path Documentation mount path.
 * @param swaggerDocumentOptions DocumentBuilder/OpenAPI configuration passed to `SwaggerModule.createDocument`.
 * @param options FlexDoc renderer/backend options; `spec` and `specUrl` are generated internally and excluded.
 */
export function setupNestFlexDoc(
  app: NestLikeApplication,
  path: string,
  swaggerDocumentOptions: Record<string, unknown>,
  options: Omit<FlexDocModuleOptions, 'path' | 'spec' | 'specUrl'> = {}
): void {
  let SwaggerModule: any;
  try {
    SwaggerModule = require('@nestjs/swagger').SwaggerModule;
  } catch {
    throw new Error('setupNestFlexDoc requires @nestjs/swagger to be installed');
  }
  const spec = SwaggerModule.createDocument(app, swaggerDocumentOptions);
  const adapter = app.getHttpAdapter();
  const instance = adapter.getInstance();
  const type = adapter.getType?.();
  if (type === 'fastify' || (!instance.use && typeof instance.get === 'function')) {
    setupFastifyFlexDoc(instance, path, { ...options, spec });
  } else {
    setupExpressFlexDoc(instance, path, { ...options, spec });
  }
}
