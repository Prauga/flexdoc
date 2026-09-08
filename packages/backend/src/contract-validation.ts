/** Severity assigned to one runtime-vs-contract validation finding. */
export type FlexDocContractValidationSeverity = 'error' | 'warning' | 'info';

/** Stable machine-readable validation codes emitted by the 3.1 contract validator. */
export type FlexDocContractValidationCode =
  | 'runtime.operation-undocumented'
  | 'runtime.operation-unobserved'
  | 'runtime.method-mismatch'
  | 'runtime.duplicate-operation';

/** Normalized HTTP operation identity used by contract validation. */
export interface FlexDocContractRoute {
  /** Uppercase HTTP method. */ method: string;
  /** Normalized route path/template. */ path: string;
}

/** One runtime operation registered more than once by the host framework. */
export interface FlexDocContractDuplicateRuntimeRoute extends FlexDocContractRoute {
  /** Number of runtime registrations observed for this wire-equivalent operation. */
  count: number;
}

/** Location in the API contract associated with a validation finding. */
export interface FlexDocContractValidationLocation {
  /** Validation target category. 3.1 starts with operation-level runtime checks. */ kind: 'operation';
  /** Normalized OpenAPI/runtime path template. */ path: string;
  /** HTTP method when the finding applies to one specific operation. */ method?: string;
}

/** One actionable mismatch between the OpenAPI contract and the running backend. */
export interface FlexDocContractValidationFinding {
  /** Deterministic finding id suitable for UI keys and automation baselines. */ id: string;
  /** Machine-readable finding code. */ code: FlexDocContractValidationCode;
  /** Finding severity. */ severity: FlexDocContractValidationSeverity;
  /** Contract/runtime location associated with the mismatch. */ location: FlexDocContractValidationLocation;
  /** Human-readable explanation suitable for UI and CI output. */ message: string;
  /** Concise expected contract/runtime state. */ expected?: string | string[];
  /** Concise state actually observed from the running backend. */ observed?: string | string[];
}

/** Aggregate finding counts for one contract-validation pass. */
export interface FlexDocContractValidationSummary {
  /** Total number of validation findings. */ total: number;
  /** Number of error findings. */ errors: number;
  /** Number of warning findings. */ warnings: number;
  /** Number of informational findings. */ info: number;
}

/** Overall outcome of one runtime contract-validation pass. */
export type FlexDocContractValidationStatus = 'pass' | 'warn' | 'fail' | 'partial';

/** Structured contract-validation result embedded in Runtime Intelligence snapshots. */
export interface FlexDocContractValidationResult {
  /** Overall validation status derived from findings and discovery completeness. */ status: FlexDocContractValidationStatus;
  /** Whether runtime route discovery was complete enough to make absence claims authoritative. */ complete: boolean;
  /** Deterministically ordered actionable validation findings. */ findings: FlexDocContractValidationFinding[];
  /** Aggregate finding counts. */ summary: FlexDocContractValidationSummary;
}

/** Inputs accepted by the framework-neutral runtime route contract validator. */
export interface ValidateRuntimeContractOptions {
  /** Normalized operations extracted from the OpenAPI document. */ documentedRoutes: FlexDocContractRoute[];
  /** Normalized operations discovered from the running backend. */ runtimeRoutes: FlexDocContractRoute[];
  /** Runtime operations that were registered more than once by the host framework. */ duplicateRuntimeRoutes?: FlexDocContractDuplicateRuntimeRoute[];
  /** Whether route discovery is believed to cover the complete running application. */ discoveryComplete: boolean;
}

function routeShape(path: string): string {
  return path.replace(/\{[^/{}]+\}/g, '{}');
}

function exactShapeKey(route: FlexDocContractRoute): string {
  return `${route.method.toUpperCase()} ${routeShape(route.path)}`;
}

function findingId(code: FlexDocContractValidationCode, path: string, method?: string): string {
  return `${code}:${method ? `${method}:` : ''}${routeShape(path)}`;
}

function groupedMethods(routes: FlexDocContractRoute[]): Map<string, string[]> {
  const grouped = new Map<string, Set<string>>();
  for (const route of routes) {
    const shape = routeShape(route.path);
    const methods = grouped.get(shape) || new Set<string>();
    methods.add(route.method.toUpperCase());
    grouped.set(shape, methods);
  }
  return new Map([...grouped.entries()].map(([shape, methods]) => [shape, [...methods].sort()]));
}

function representativePath(routes: FlexDocContractRoute[], shape: string): string {
  return routes.find((route) => routeShape(route.path) === shape)?.path || shape;
}

/**
 * Compare documented OpenAPI operations with routes observed from the running backend.
 *
 * Path-parameter names are intentionally ignored for route identity because framework-local
 * names such as `:id` and OpenAPI names such as `{petId}` describe the same wire path shape.
 * Duplicate runtime registrations remain distinct host observations and are surfaced separately.
 *
 * @param options Documented/runtime normalized routes plus route-discovery completeness.
 * @returns Structured validation findings and aggregate status for UI or automation.
 */
export function validateRuntimeContract(options: ValidateRuntimeContractOptions): FlexDocContractValidationResult {
  const documentedKeys = new Set(options.documentedRoutes.map(exactShapeKey));
  const runtimeKeys = new Set(options.runtimeRoutes.map(exactShapeKey));
  const findings: FlexDocContractValidationFinding[] = [];

  for (const duplicate of options.duplicateRuntimeRoutes || []) {
    const method = duplicate.method.toUpperCase();
    findings.push({
      id: findingId('runtime.duplicate-operation', duplicate.path, method),
      code: 'runtime.duplicate-operation',
      severity: 'warning',
      location: { kind: 'operation', method, path: duplicate.path },
      message: `Runtime registers ${method} ${duplicate.path} ${duplicate.count} times. Multiple host registrations can shadow or chain handlers behind one documented operation.`,
      expected: 'One runtime registration for this HTTP operation',
      observed: `${duplicate.count} runtime registrations`,
    });
  }

  const documentedMethods = groupedMethods(options.documentedRoutes);
  const runtimeMethods = groupedMethods(options.runtimeRoutes);
  const methodMismatchShapes = new Set<string>();

  for (const [shape, expectedMethods] of documentedMethods) {
    const observedMethods = runtimeMethods.get(shape);
    if (!observedMethods) continue;
    const hasExact = expectedMethods.some((method) => observedMethods.includes(method));
    if (hasExact) continue;
    methodMismatchShapes.add(shape);
    const path = representativePath(options.documentedRoutes, shape);
    findings.push({
      id: findingId('runtime.method-mismatch', path),
      code: 'runtime.method-mismatch',
      severity: options.discoveryComplete ? 'error' : 'warning',
      location: { kind: 'operation', path },
      message: `Runtime route ${path} is registered for different HTTP methods than OpenAPI documents.`,
      expected: expectedMethods,
      observed: observedMethods,
    });
  }

  for (const route of options.runtimeRoutes) {
    const shape = routeShape(route.path);
    if (methodMismatchShapes.has(shape)) continue;
    if (documentedKeys.has(exactShapeKey(route))) continue;
    findings.push({
      id: findingId('runtime.operation-undocumented', route.path, route.method),
      code: 'runtime.operation-undocumented',
      severity: 'warning',
      location: { kind: 'operation', method: route.method.toUpperCase(), path: route.path },
      message: `Runtime implements ${route.method.toUpperCase()} ${route.path}, but OpenAPI does not document that operation.`,
      expected: 'Operation is represented in OpenAPI',
      observed: 'Operation exists only in the running backend',
    });
  }

  for (const route of options.documentedRoutes) {
    const shape = routeShape(route.path);
    if (methodMismatchShapes.has(shape)) continue;
    if (runtimeKeys.has(exactShapeKey(route))) continue;
    findings.push({
      id: findingId('runtime.operation-unobserved', route.path, route.method),
      code: 'runtime.operation-unobserved',
      severity: options.discoveryComplete ? 'error' : 'info',
      location: { kind: 'operation', method: route.method.toUpperCase(), path: route.path },
      message: options.discoveryComplete
        ? `OpenAPI documents ${route.method.toUpperCase()} ${route.path}, but the running backend does not expose that operation.`
        : `OpenAPI documents ${route.method.toUpperCase()} ${route.path}, but it was not observed during partial runtime discovery.`,
      expected: 'Operation is exposed by the running backend',
      observed: options.discoveryComplete ? 'No matching runtime operation exists' : 'No matching operation was observed during partial discovery',
    });
  }

  const ordered = findings.sort((left, right) => {
    const rank = { error: 0, warning: 1, info: 2 } as const;
    return rank[left.severity] - rank[right.severity]
      || left.location.path.localeCompare(right.location.path)
      || (left.location.method || '').localeCompare(right.location.method || '')
      || left.code.localeCompare(right.code);
  });
  const summary: FlexDocContractValidationSummary = {
    total: ordered.length,
    errors: ordered.filter((finding) => finding.severity === 'error').length,
    warnings: ordered.filter((finding) => finding.severity === 'warning').length,
    info: ordered.filter((finding) => finding.severity === 'info').length,
  };
  const status: FlexDocContractValidationStatus = summary.errors > 0
    ? 'fail'
    : summary.warnings > 0
      ? 'warn'
      : !options.discoveryComplete
        ? 'partial'
        : 'pass';

  return { status, complete: options.discoveryComplete, findings: ordered, summary };
}
