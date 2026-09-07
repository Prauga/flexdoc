import type { FlexDocRuntimeIntelligenceOptions } from './interfaces';

export interface FlexDocRuntimeRoute {
  method: string;
  path: string;
}

export interface FlexDocRuntimeMetadata {
  name: 'node';
  version: string;
  platform: string;
  arch: string;
}

export interface FlexDocRuntimeServerMetadata {
  localPort?: number;
}

export interface FlexDocRuntimeEnvironmentMetadata {
  name: string;
}

export interface FlexDocRuntimeDiscovery {
  framework: string;
  frameworkVersion?: string;
  routes: FlexDocRuntimeRoute[];
  complete: boolean;
}

export interface FlexDocRuntimeIntelligenceSnapshot {
  framework: string;
  frameworkVersion?: string;
  runtime: FlexDocRuntimeMetadata;
  serverOrigin?: string;
  server?: FlexDocRuntimeServerMetadata;
  environment?: FlexDocRuntimeEnvironmentMetadata;
  discoveryComplete: boolean;
  routes: FlexDocRuntimeRoute[];
  runtimeOnly: FlexDocRuntimeRoute[];
  documentedOnly: FlexDocRuntimeRoute[];
  summary: {
    documented: number;
    runtime: number;
    matched: number;
    runtimeOnly: number;
    documentedOnly: number;
  };
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE']);

export function runtimeIntelligenceEnabled(value: boolean | FlexDocRuntimeIntelligenceOptions | undefined): boolean {
  return value === true || (typeof value === 'object' && value?.enabled === true);
}

export function normalizeRuntimePath(value: string): string {
  let path = value.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/:([A-Za-z0-9_]+)(?:\([^)]*\))?[?+*]?/g, '{$1}');
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function normalizedRoute(method: string, path: string): FlexDocRuntimeRoute | null {
  const normalizedMethod = method.toUpperCase();
  if (!HTTP_METHODS.has(normalizedMethod) || typeof path !== 'string') return null;
  return { method: normalizedMethod, path: normalizeRuntimePath(path) };
}

function routeKey(route: FlexDocRuntimeRoute): string {
  return `${route.method} ${route.path}`;
}

function uniqueSorted(routes: FlexDocRuntimeRoute[]): FlexDocRuntimeRoute[] {
  const byKey = new Map<string, FlexDocRuntimeRoute>();
  for (const route of routes) byKey.set(routeKey(route), route);
  return [...byKey.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function isExcludedRoute(path: string, excludePrefix?: string): boolean {
  if (!excludePrefix) return false;
  const excluded = normalizeRuntimePath(excludePrefix);
  return path === excluded || path.startsWith(`${excluded}/`);
}

function withoutImplicitHeadRoutes(routes: FlexDocRuntimeRoute[]): FlexDocRuntimeRoute[] {
  const keys = new Set(routes.map(routeKey));
  return routes.filter((route) => route.method !== 'HEAD' || !keys.has(`GET ${route.path}`));
}

export function nodeRuntimeMetadata(): FlexDocRuntimeMetadata {
  return {
    name: 'node',
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

export function nodeEnvironmentMetadata(): FlexDocRuntimeEnvironmentMetadata | undefined {
  const name = process.env.NODE_ENV?.trim();
  return name ? { name } : undefined;
}

export function discoverExpressRoutes(app: any, excludePrefix?: string): FlexDocRuntimeDiscovery {
  const router = app?.router || app?._router;
  const stack = Array.isArray(router?.stack) ? router.stack : null;
  if (!stack) return { framework: 'express', routes: [], complete: false };

  const routes: FlexDocRuntimeRoute[] = [];
  let complete = true;

  const visit = (layers: any[], prefix = '') => {
    for (const layer of layers) {
      const route = layer?.route;
      if (route) {
        const rawPaths = Array.isArray(route.path) ? route.path : [route.path];
        for (const rawPath of rawPaths) {
          if (typeof rawPath !== 'string') { complete = false; continue; }
          const fullPath = normalizeRuntimePath(`${prefix}${rawPath}`);
          if (isExcludedRoute(fullPath, excludePrefix)) continue;
          for (const [method, enabled] of Object.entries(route.methods || {})) {
            if (!enabled) continue;
            const candidate = normalizedRoute(method, fullPath);
            if (candidate) routes.push(candidate);
          }
        }
        continue;
      }

      if (Array.isArray(layer?.handle?.stack)) {
        if (typeof layer.path === 'string') visit(layer.handle.stack, `${prefix}${normalizeRuntimePath(layer.path)}`);
        else complete = false;
      }
    }
  };

  visit(stack);
  return { framework: 'express', routes: uniqueSorted(routes), complete };
}

export async function discoverFastifyRoutes(app: any, excludePrefix?: string): Promise<FlexDocRuntimeDiscovery> {
  const frameworkVersion = typeof app?.version === 'string' ? app.version : undefined;
  if (typeof app?.printRoutes !== 'function') {
    return { framework: 'fastify', ...(frameworkVersion ? { frameworkVersion } : {}), routes: [], complete: false };
  }

  try {
    if (typeof app?.ready === 'function') await app.ready();
    const printed = app.printRoutes({ commonPrefix: false });
    if (typeof printed !== 'string') {
      return { framework: 'fastify', ...(frameworkVersion ? { frameworkVersion } : {}), routes: [], complete: false };
    }

    const fragments: string[] = [];
    const routes: FlexDocRuntimeRoute[] = [];
    let complete = true;

    for (const line of printed.split(/\r?\n/)) {
      if (!line.trim() || line.includes('•')) continue;
      const branch = Math.max(line.lastIndexOf('├── '), line.lastIndexOf('└── '));
      if (branch < 0 || branch % 4 !== 0) { complete = false; continue; }
      const depth = branch / 4;
      const label = line.slice(branch + 4).trim();
      const match = label.match(/^(.*?)\s+\(([^)]+)\)(?:\s+.*)?$/);
      const fragment = (match?.[1] || label).trim();
      fragments[depth] = fragment;
      fragments.length = depth + 1;
      if (!match) continue;

      const fullPath = normalizeRuntimePath(fragments.join(''));
      if (isExcludedRoute(fullPath, excludePrefix)) continue;
      for (const method of match[2].split(',').map((value) => value.trim()).filter(Boolean)) {
        const candidate = normalizedRoute(method, fullPath);
        if (candidate) routes.push(candidate);
        else complete = false;
      }
    }

    return {
      framework: 'fastify',
      ...(frameworkVersion ? { frameworkVersion } : {}),
      routes: uniqueSorted(withoutImplicitHeadRoutes(routes)),
      complete,
    };
  } catch {
    return { framework: 'fastify', ...(frameworkVersion ? { frameworkVersion } : {}), routes: [], complete: false };
  }
}

export function discoverHonoRoutes(app: any, excludePrefix?: string): FlexDocRuntimeDiscovery {
  const source = Array.isArray(app?.routes) ? app.routes : null;
  if (!source) return { framework: 'hono', routes: [], complete: false };

  const routes: FlexDocRuntimeRoute[] = [];
  let complete = true;
  for (const route of source) {
    if (!route || typeof route.path !== 'string' || typeof route.method !== 'string') { complete = false; continue; }
    const method = route.method.toUpperCase();
    if (method === 'ALL' || method === '*') { complete = false; continue; }
    const fullPath = normalizeRuntimePath(route.path);
    if (isExcludedRoute(fullPath, excludePrefix)) continue;
    const candidate = normalizedRoute(method, fullPath);
    if (candidate) routes.push(candidate);
    else complete = false;
  }

  return { framework: 'hono', routes: uniqueSorted(routes), complete };
}

export function documentedOpenApiRoutes(spec: any): FlexDocRuntimeRoute[] {
  const routes: FlexDocRuntimeRoute[] = [];
  for (const [path, pathItem] of Object.entries(spec?.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of Object.keys(pathItem as Record<string, unknown>)) {
      const candidate = normalizedRoute(method, path);
      if (candidate) routes.push(candidate);
    }
  }
  return uniqueSorted(routes);
}

export function buildRuntimeIntelligenceSnapshot(input: {
  spec: any;
  discovery: FlexDocRuntimeDiscovery;
  serverOrigin?: string;
  server?: FlexDocRuntimeServerMetadata;
  environment?: FlexDocRuntimeEnvironmentMetadata;
  runtime?: FlexDocRuntimeMetadata;
}): FlexDocRuntimeIntelligenceSnapshot {
  const documented = documentedOpenApiRoutes(input.spec);
  const runtimeRoutes = uniqueSorted(input.discovery.routes);
  const documentedKeys = new Set(documented.map(routeKey));
  const runtimeKeys = new Set(runtimeRoutes.map(routeKey));
  const matched = runtimeRoutes.filter((route) => documentedKeys.has(routeKey(route))).length;
  const runtimeOnly = runtimeRoutes.filter((route) => !documentedKeys.has(routeKey(route)));
  const documentedOnly = documented.filter((route) => !runtimeKeys.has(routeKey(route)));
  const environment = input.environment || nodeEnvironmentMetadata();

  return {
    framework: input.discovery.framework,
    ...(input.discovery.frameworkVersion ? { frameworkVersion: input.discovery.frameworkVersion } : {}),
    runtime: input.runtime || nodeRuntimeMetadata(),
    ...(input.serverOrigin ? { serverOrigin: input.serverOrigin } : {}),
    ...(input.server ? { server: input.server } : {}),
    ...(environment ? { environment } : {}),
    discoveryComplete: input.discovery.complete,
    routes: runtimeRoutes,
    runtimeOnly,
    documentedOnly,
    summary: {
      documented: documented.length,
      runtime: runtimeRoutes.length,
      matched,
      runtimeOnly: runtimeOnly.length,
      documentedOnly: documentedOnly.length,
    },
  };
}
