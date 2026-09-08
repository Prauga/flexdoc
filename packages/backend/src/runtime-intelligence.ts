import type { FlexDocRuntimeIntelligenceOptions } from './interfaces';
import { validateRuntimeContract } from './contract-validation';
import type { FlexDocContractValidationResult } from './contract-validation';

/** One normalized HTTP route observed from OpenAPI or the running backend. */
export interface FlexDocRuntimeRoute {
  /** Uppercase HTTP method. */ method: string;
  /** Normalized route path/template, using `{name}` path parameters. */ path: string;
}

/** One wire-equivalent runtime operation registered more than once. */
export interface FlexDocRuntimeDuplicateRoute extends FlexDocRuntimeRoute {
  /** Number of matching registrations observed in the host framework. */ count: number;
}

/** Runtime process metadata included in Runtime Intelligence snapshots. */
export interface FlexDocRuntimeMetadata {
  /** Runtime identifier. Node backend integrations report `node`. */ name: 'node';
  /** Runtime version string, including the Node.js `v` prefix. */ version: string;
  /** Operating-system platform reported by Node.js. */ platform: string;
  /** Process architecture reported by Node.js. */ arch: string;
}

/** Backend listener metadata safe to expose in Runtime Intelligence. */
export interface FlexDocRuntimeServerMetadata {
  /** Local TCP listener port when the adapter can determine it from the incoming request. */ localPort?: number;
}

/** Safe environment metadata exposed by Runtime Intelligence. */
export interface FlexDocRuntimeEnvironmentMetadata {
  /** Environment name supplied by the host; Node adapters default to `NODE_ENV` when present. */ name: string;
}

/** Framework-specific route discovery result before comparison with OpenAPI. */
export interface FlexDocRuntimeDiscovery {
  /** Framework identifier, such as `express`, `fastify`, or `hono`. */ framework: string;
  /** Framework version when the host exposes it. */ frameworkVersion?: string;
  /** Normalized routes observed from the running application. */ routes: FlexDocRuntimeRoute[];
  /** Wire-equivalent runtime operations registered more than once, when observed. */ duplicateRoutes?: FlexDocRuntimeDuplicateRoute[];
  /** Whether the adapter believes route discovery covered the complete application route set. */ complete: boolean;
}

/** Aggregate route counts in a Runtime Intelligence snapshot. */
export interface FlexDocRuntimeIntelligenceSummary {
  /** Number of documented OpenAPI operations. */ documented: number;
  /** Number of runtime routes observed. */ runtime: number;
  /** Number of wire-equivalent method/path matches between runtime and OpenAPI. */ matched: number;
  /** Number of runtime-only routes. */ runtimeOnly: number;
  /** Number of documented-only routes. */ documentedOnly: number;
}

/** Snapshot comparing documented OpenAPI routes with routes discovered at runtime. */
export interface FlexDocRuntimeIntelligenceSnapshot {
  /** Framework identifier reported by route discovery. */ framework: string;
  /** Framework version when the integration can detect it. */ frameworkVersion?: string;
  /** Runtime/process metadata for the documentation host. */ runtime: FlexDocRuntimeMetadata;
  /** Origin inferred for the backend handling the documentation request. */ serverOrigin?: string;
  /** Listener metadata observed from the backend request/socket. */ server?: FlexDocRuntimeServerMetadata;
  /** Safe environment metadata associated with the running backend. */ environment?: FlexDocRuntimeEnvironmentMetadata;
  /** Whether runtime route discovery is believed to be complete. */ discoveryComplete: boolean;
  /** All normalized runtime routes after FlexDoc-owned paths are excluded. */ routes: FlexDocRuntimeRoute[];
  /** Runtime routes that do not have a wire-equivalent matching OpenAPI operation. */ runtimeOnly: FlexDocRuntimeRoute[];
  /** OpenAPI operations that were not observed as wire-equivalent runtime routes. */ documentedOnly: FlexDocRuntimeRoute[];
  /** Aggregate route counts used by the Runtime Intelligence UI and automation. */ summary: FlexDocRuntimeIntelligenceSummary;
  /** Structured 3.1 runtime-vs-OpenAPI contract validation result. */ validation: FlexDocContractValidationResult;
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE']);

/**
 * Test whether Runtime Intelligence was explicitly enabled for a backend mount.
 * @param value Boolean shorthand or Runtime Intelligence options.
 * @returns `true` only for `true` or an options object with `enabled: true`.
 */
export function runtimeIntelligenceEnabled(value: boolean | FlexDocRuntimeIntelligenceOptions | undefined): boolean {
  return value === true || (typeof value === 'object' && value?.enabled === true);
}

/**
 * Normalize a framework route path for Runtime Intelligence comparisons.
 * @param value Framework route path or template.
 * @returns Leading-slash path with Express-style parameters converted to `{name}`, duplicate slashes removed, and trailing slash normalized.
 */
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

function contractRouteKey(route: FlexDocRuntimeRoute): string {
  return `${route.method} ${route.path.replace(/\{[^/{}]+\}/g, '{}')}`;
}

function uniqueSorted(routes: FlexDocRuntimeRoute[]): FlexDocRuntimeRoute[] {
  const byKey = new Map<string, FlexDocRuntimeRoute>();
  for (const route of routes) {
    const key = contractRouteKey(route);
    if (!byKey.has(key)) byKey.set(key, route);
  }
  return [...byKey.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function duplicateRuntimeRoutes(routes: FlexDocRuntimeRoute[]): FlexDocRuntimeDuplicateRoute[] {
  const registrations = new Map<string, { route: FlexDocRuntimeRoute; count: number }>();
  for (const route of routes) {
    const key = contractRouteKey(route);
    const current = registrations.get(key);
    if (current) current.count += 1;
    else registrations.set(key, { route, count: 1 });
  }
  return [...registrations.values()]
    .filter(({ count }) => count > 1)
    .map(({ route, count }) => ({ ...route, count }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
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

/**
 * Return Node.js runtime metadata for Runtime Intelligence snapshots.
 * @returns Current Node version, platform, and architecture.
 */
export function nodeRuntimeMetadata(): FlexDocRuntimeMetadata {
  return {
    name: 'node',
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Read safe environment metadata from the Node.js host.
 * @returns `{ name: NODE_ENV }` when `NODE_ENV` is non-empty, otherwise `undefined`.
 */
export function nodeEnvironmentMetadata(): FlexDocRuntimeEnvironmentMetadata | undefined {
  const name = process.env.NODE_ENV?.trim();
  return name ? { name } : undefined;
}

/**
 * Discover normalized HTTP routes from an Express application router stack.
 * @param app Express application or router-like object exposing `router.stack`/`_router.stack`.
 * @param excludePrefix Optional documentation mount prefix excluded from discovery.
 * @returns Framework discovery result; `complete` is false when unsupported/nested route shapes prevent exhaustive discovery.
 */
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
  const duplicates = duplicateRuntimeRoutes(routes);
  return {
    framework: 'express',
    routes: uniqueSorted(routes),
    ...(duplicates.length ? { duplicateRoutes: duplicates } : {}),
    complete,
  };
}

/**
 * Discover normalized HTTP routes from Fastify's printable route tree.
 * @param app Fastify application exposing `printRoutes`, and optionally `ready`/`version`.
 * @param excludePrefix Optional documentation mount prefix excluded from discovery.
 * @returns Promise resolving to framework discovery metadata. Parse/runtime failures are represented as `complete: false`, not thrown.
 */
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

    const explicitRoutes = withoutImplicitHeadRoutes(routes);
    const duplicates = duplicateRuntimeRoutes(explicitRoutes);
    return {
      framework: 'fastify',
      ...(frameworkVersion ? { frameworkVersion } : {}),
      routes: uniqueSorted(explicitRoutes),
      ...(duplicates.length ? { duplicateRoutes: duplicates } : {}),
      complete,
    };
  } catch {
    return { framework: 'fastify', ...(frameworkVersion ? { frameworkVersion } : {}), routes: [], complete: false };
  }
}

/**
 * Discover normalized HTTP routes from Hono's registered route list.
 * @param app Hono application exposing a `routes` array.
 * @param excludePrefix Optional documentation mount prefix excluded from discovery.
 * @returns Framework discovery result. Wildcard/ALL routes mark discovery incomplete because they cannot map to a single HTTP operation.
 */
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

  const duplicates = duplicateRuntimeRoutes(routes);
  return {
    framework: 'hono',
    routes: uniqueSorted(routes),
    ...(duplicates.length ? { duplicateRoutes: duplicates } : {}),
    complete,
  };
}

/**
 * Extract normalized documented HTTP routes from an OpenAPI document.
 * @param spec OpenAPI-like object containing a `paths` map.
 * @returns Unique, sorted method/path signatures recognized as HTTP operations.
 */
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

/** Options used to build a Runtime Intelligence snapshot from one discovery pass. */
export interface FlexDocRuntimeIntelligenceSnapshotInput {
  /** OpenAPI document compared with discovered routes. */ spec: any;
  /** Framework route-discovery result. */ discovery: FlexDocRuntimeDiscovery;
  /** Backend origin inferred from the incoming documentation request. */ serverOrigin?: string;
  /** Safe backend listener metadata. */ server?: FlexDocRuntimeServerMetadata;
  /** Explicit environment metadata; Node's `NODE_ENV` fallback is used when omitted. */ environment?: FlexDocRuntimeEnvironmentMetadata;
  /** Explicit runtime metadata; current Node process metadata is used when omitted. */ runtime?: FlexDocRuntimeMetadata;
}

/**
 * Build a Runtime Intelligence snapshot from discovery results and the OpenAPI spec.
 * @param input OpenAPI document, discovery result, and optional host metadata.
 * @returns Deterministic route-presence comparison, structured contract validation, and safe runtime metadata.
 */
export function buildRuntimeIntelligenceSnapshot(input: FlexDocRuntimeIntelligenceSnapshotInput): FlexDocRuntimeIntelligenceSnapshot {
  const documented = documentedOpenApiRoutes(input.spec);
  const runtimeRoutes = uniqueSorted(input.discovery.routes);
  const documentedKeys = new Set(documented.map(contractRouteKey));
  const runtimeKeys = new Set(runtimeRoutes.map(contractRouteKey));
  const matched = runtimeRoutes.filter((route) => documentedKeys.has(contractRouteKey(route))).length;
  const runtimeOnly = runtimeRoutes.filter((route) => !documentedKeys.has(contractRouteKey(route)));
  const documentedOnly = documented.filter((route) => !runtimeKeys.has(contractRouteKey(route)));
  const environment = input.environment || nodeEnvironmentMetadata();
  const validation = validateRuntimeContract({
    documentedRoutes: documented,
    runtimeRoutes,
    duplicateRuntimeRoutes: input.discovery.duplicateRoutes,
    discoveryComplete: input.discovery.complete,
  });

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
    validation,
  };
}
