import type { FlexDocRuntimeIntelligenceOptions } from './interfaces';

export interface FlexDocRuntimeRoute {
  method: string;
  path: string;
}

export interface FlexDocRuntimeDiscovery {
  framework: string;
  routes: FlexDocRuntimeRoute[];
  complete: boolean;
}

export interface FlexDocRuntimeIntelligenceSnapshot {
  framework: string;
  serverOrigin?: string;
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
  if (value === true) return true;
  if (!value) return false;
  return value.enabled !== false;
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

export function discoverExpressRoutes(app: any, excludePrefix?: string): FlexDocRuntimeDiscovery {
  const router = app?.router || app?._router;
  const stack = Array.isArray(router?.stack) ? router.stack : null;
  if (!stack) return { framework: 'express', routes: [], complete: false };

  const routes: FlexDocRuntimeRoute[] = [];
  let complete = true;
  const excluded = excludePrefix ? normalizeRuntimePath(excludePrefix) : undefined;

  const visit = (layers: any[], prefix = '') => {
    for (const layer of layers) {
      const route = layer?.route;
      if (route) {
        const rawPaths = Array.isArray(route.path) ? route.path : [route.path];
        for (const rawPath of rawPaths) {
          if (typeof rawPath !== 'string') { complete = false; continue; }
          const fullPath = normalizeRuntimePath(`${prefix}${rawPath}`);
          if (excluded && (fullPath === excluded || fullPath.startsWith(`${excluded}/`))) continue;
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
}): FlexDocRuntimeIntelligenceSnapshot {
  const documented = documentedOpenApiRoutes(input.spec);
  const runtime = uniqueSorted(input.discovery.routes);
  const documentedKeys = new Set(documented.map(routeKey));
  const runtimeKeys = new Set(runtime.map(routeKey));
  const matched = runtime.filter((route) => documentedKeys.has(routeKey(route))).length;
  const runtimeOnly = runtime.filter((route) => !documentedKeys.has(routeKey(route)));
  const documentedOnly = documented.filter((route) => !runtimeKeys.has(routeKey(route)));

  return {
    framework: input.discovery.framework,
    ...(input.serverOrigin ? { serverOrigin: input.serverOrigin } : {}),
    discoveryComplete: input.discovery.complete,
    routes: runtime,
    runtimeOnly,
    documentedOnly,
    summary: {
      documented: documented.length,
      runtime: runtime.length,
      matched,
      runtimeOnly: runtimeOnly.length,
      documentedOnly: documentedOnly.length,
    },
  };
}
