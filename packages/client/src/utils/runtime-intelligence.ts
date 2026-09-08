import type {
  FlexDocContractValidationCode,
  FlexDocContractValidationFinding,
  FlexDocContractValidationResult,
  FlexDocContractValidationSeverity,
  FlexDocContractValidationStatus,
  FlexDocRuntimeIntelligenceSnapshot,
  FlexDocRuntimeRoute,
} from '../types/options';

const INVALID_SNAPSHOT_MESSAGE = 'Runtime intelligence returned an invalid snapshot.';

const VALIDATION_CODES = new Set<FlexDocContractValidationCode>([
  'runtime.operation-undocumented',
  'runtime.operation-unobserved',
  'runtime.method-mismatch',
  'runtime.duplicate-operation',
]);
const VALIDATION_SEVERITIES = new Set<FlexDocContractValidationSeverity>(['error', 'warning', 'info']);
const VALIDATION_STATUSES = new Set<FlexDocContractValidationStatus>(['pass', 'warn', 'fail', 'partial']);

type UnknownRecord = Record<string, unknown>;

function invalidSnapshot(): never {
  throw new Error(INVALID_SNAPSHOT_MESSAGE);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') invalidSnapshot();
  return value;
}

function optionalString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') invalidSnapshot();
  return value;
}

function optionalStringOrStrings(record: UnknownRecord, key: string): string | string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.trim() !== '')) {
    return [...value];
  }
  invalidSnapshot();
}

function count(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) invalidSnapshot();
  return value;
}

function runtimeRoute(value: unknown): FlexDocRuntimeRoute {
  if (!isRecord(value)) invalidSnapshot();
  return { method: requiredString(value, 'method'), path: requiredString(value, 'path') };
}

function runtimeRoutes(value: unknown): FlexDocRuntimeRoute[] {
  if (!Array.isArray(value)) invalidSnapshot();
  return value.map(runtimeRoute);
}

function validationFinding(value: unknown): FlexDocContractValidationFinding {
  if (!isRecord(value) || !isRecord(value.location)) invalidSnapshot();
  const code = requiredString(value, 'code') as FlexDocContractValidationCode;
  const severity = requiredString(value, 'severity') as FlexDocContractValidationSeverity;
  if (!VALIDATION_CODES.has(code) || !VALIDATION_SEVERITIES.has(severity) || value.location.kind !== 'operation') invalidSnapshot();

  const finding: FlexDocContractValidationFinding = {
    id: requiredString(value, 'id'),
    code,
    severity,
    location: {
      kind: 'operation',
      path: requiredString(value.location, 'path'),
    },
    message: requiredString(value, 'message'),
  };
  const method = optionalString(value.location, 'method');
  if (method) finding.location.method = method;
  const expected = optionalStringOrStrings(value, 'expected');
  if (expected !== undefined) finding.expected = expected;
  const observed = optionalStringOrStrings(value, 'observed');
  if (observed !== undefined) finding.observed = observed;
  return finding;
}

function contractValidation(value: unknown): FlexDocContractValidationResult {
  if (!isRecord(value) || !isRecord(value.summary) || !Array.isArray(value.findings) || typeof value.complete !== 'boolean') invalidSnapshot();
  const status = requiredString(value, 'status') as FlexDocContractValidationStatus;
  if (!VALIDATION_STATUSES.has(status)) invalidSnapshot();

  const findings = value.findings.map(validationFinding);
  const summary = {
    total: count(value.summary, 'total'),
    errors: count(value.summary, 'errors'),
    warnings: count(value.summary, 'warnings'),
    info: count(value.summary, 'info'),
  };
  const observedSummary = {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  };
  if (JSON.stringify(summary) !== JSON.stringify(observedSummary)) invalidSnapshot();

  return { status, complete: value.complete, findings, summary };
}

export function parseRuntimeIntelligenceSnapshot(value: unknown): FlexDocRuntimeIntelligenceSnapshot {
  if (!isRecord(value)) invalidSnapshot();
  if (!isRecord(value.runtime) || !isRecord(value.summary)) invalidSnapshot();
  if (typeof value.discoveryComplete !== 'boolean') invalidSnapshot();

  const runtime = {
    name: requiredString(value.runtime, 'name'),
    version: requiredString(value.runtime, 'version'),
    platform: requiredString(value.runtime, 'platform'),
    arch: requiredString(value.runtime, 'arch'),
  };
  const summary = {
    documented: count(value.summary, 'documented'),
    runtime: count(value.summary, 'runtime'),
    matched: count(value.summary, 'matched'),
    runtimeOnly: count(value.summary, 'runtimeOnly'),
    documentedOnly: count(value.summary, 'documentedOnly'),
  };

  const snapshot: FlexDocRuntimeIntelligenceSnapshot = {
    framework: requiredString(value, 'framework'),
    runtime,
    discoveryComplete: value.discoveryComplete,
    routes: runtimeRoutes(value.routes),
    runtimeOnly: runtimeRoutes(value.runtimeOnly),
    documentedOnly: runtimeRoutes(value.documentedOnly),
    summary,
  };

  const frameworkVersion = optionalString(value, 'frameworkVersion');
  if (frameworkVersion) snapshot.frameworkVersion = frameworkVersion;
  const serverOrigin = optionalString(value, 'serverOrigin');
  if (serverOrigin) snapshot.serverOrigin = serverOrigin;

  if (value.server !== undefined) {
    if (!isRecord(value.server)) invalidSnapshot();
    const localPort = value.server.localPort;
    if (localPort !== undefined && (typeof localPort !== 'number' || !Number.isInteger(localPort) || localPort <= 0 || localPort > 65535)) invalidSnapshot();
    snapshot.server = localPort === undefined ? {} : { localPort };
  }

  if (value.environment !== undefined) {
    if (!isRecord(value.environment)) invalidSnapshot();
    snapshot.environment = { name: requiredString(value.environment, 'name') };
  }

  if (value.validation !== undefined) snapshot.validation = contractValidation(value.validation);

  return snapshot;
}
