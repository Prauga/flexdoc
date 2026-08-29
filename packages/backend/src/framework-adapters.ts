import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { FlexDocModuleOptions } from './interfaces';
import { getRendererAssets } from './renderer-assets';
import { setupFlexDoc } from './setup';
import { generateFlexDocHTML } from './template';

export interface ExpressLikeApplication {
  use(path: string, handler: (req: any, res: any, next?: any) => void | Promise<void>): void;
}

export interface FastifyLikeReply {
  code(statusCode: number): FastifyLikeReply;
  type(contentType: string): FastifyLikeReply;
  header(name: string, value: string): FastifyLikeReply;
  send(payload: any): any;
}

export interface FastifyLikeRequest {
  headers: Record<string, string | string[] | undefined>;
}

export interface FastifyLikeApplication {
  get(path: string, options: Record<string, unknown>, handler: (req: FastifyLikeRequest, reply: FastifyLikeReply) => any | Promise<any>): void;
}

export interface NestLikeApplication {
  getHttpAdapter(): { getType?: () => string; getInstance: () => any };
}

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

export function setupFastifyFlexDoc(app: FastifyLikeApplication, path: string, options: Omit<FlexDocModuleOptions, 'path'>): void {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const rendererBasePath = `${normalizedPath}/__flexdoc`;
  const auth = options.options?.auth;
  let remoteSpecPromise: Promise<any> | null = null;

  const routeOptions = auth ? {
    preHandler: async (request: FastifyLikeRequest, reply: FastifyLikeReply) => {
      if (!authorize(request.headers, auth)) {
        reply.header('WWW-Authenticate', auth.type === 'basic' ? 'Basic' : 'Bearer');
        return reply.code(401).send('Authentication required');
      }
    },
  } : {};

  const resolvedSpec = async () => {
    if (options.spec) return options.spec;
    if (!options.specUrl) return null;
    if (!remoteSpecPromise) remoteSpecPromise = loadRemoteSpec(options.specUrl).catch((error) => {
      remoteSpecPromise = null;
      throw error;
    });
    return remoteSpecPromise;
  };

  app.get(`${rendererBasePath}/renderer.js`, routeOptions, async (_request, reply) => {
    const assets = getRendererAssets();
    return reply.type('application/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=31536000, immutable').send(assets.javascript);
  });

  app.get(`${rendererBasePath}/renderer.css`, routeOptions, async (_request, reply) => {
    const assets = getRendererAssets();
    return reply.type('text/css; charset=utf-8').header('Cache-Control', 'public, max-age=31536000, immutable').send(assets.css);
  });

  app.get(normalizedPath, routeOptions, async (_request, reply) => {
    try {
      const html = generateFlexDocHTML(await resolvedSpec(), { ...(options.options || {}), rendererBasePath });
      return reply.type('text/html; charset=utf-8').send(html);
    } catch (error) {
      return reply.code(502).type('text/plain; charset=utf-8').send(`Unable to load OpenAPI specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convenience integration for NestJS applications using @nestjs/swagger.
 * @nestjs/swagger remains optional; it is only resolved when this helper is called.
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
