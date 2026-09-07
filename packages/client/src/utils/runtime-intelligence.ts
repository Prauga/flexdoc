import type { FlexDocRuntimeIntelligenceSnapshot, FlexDocRuntimeRoute } from '../types/options';

const INVALID_SNAPSHOT_MESSAGE = 'Runtime intelligence returned an invalid snapshot.';

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

  return snapshot;
}
