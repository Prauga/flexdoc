import type { HttpKeyValue, HttpRequestDraft, HttpVariables } from './http-client';

export interface ApiClientRequestScripts {
  preRequest: string;
  tests: string;
}

export interface ApiClientScriptEnvironmentChange {
  action: 'set' | 'unset';
  key: string;
  value?: string;
}

export interface ApiClientScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ApiClientScriptResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
  responseTime: number;
}

export interface ApiClientScriptRunResult {
  draft: HttpRequestDraft;
  variables: HttpVariables;
  environmentVariables: HttpVariables;
  environmentChanges: ApiClientScriptEnvironmentChange[];
  tests: ApiClientScriptTestResult[];
  logs: string[];
  error?: string;
}

export const EMPTY_API_CLIENT_SCRIPTS: ApiClientRequestScripts = { preRequest: '', tests: '' };

export function cloneApiClientScripts(scripts?: Partial<ApiClientRequestScripts>): ApiClientRequestScripts {
  return {
    preRequest: scripts?.preRequest || '',
    tests: scripts?.tests || '',
  };
}

function cloneDraft(draft: HttpRequestDraft): HttpRequestDraft {
  return {
    ...draft,
    query: draft.query?.map((entry) => ({ ...entry })),
    headers: draft.headers?.map((entry) => ({ ...entry })),
    auth: draft.auth ? { ...draft.auth } : undefined,
  };
}

function safeVariables(values: HttpVariables): HttpVariables {
  return Object.assign(Object.create(null) as HttpVariables, values);
}

function formatLogValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left)) {
    return Array.isArray(right) && left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && deepEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
}

function assertionError(message: string): never {
  throw new Error(message);
}

function createExpectation(actual: unknown) {
  const equal = (expected: unknown) => {
    if (!Object.is(actual, expected)) assertionError(`expected ${formatLogValue(actual)} to equal ${formatLogValue(expected)}`);
  };
  const eql = (expected: unknown) => {
    if (!deepEqual(actual, expected)) assertionError(`expected ${formatLogValue(actual)} to deeply equal ${formatLogValue(expected)}`);
  };
  const include = (expected: unknown) => {
    const included = typeof actual === 'string'
      ? actual.includes(String(expected))
      : Array.isArray(actual)
        ? actual.some((value) => deepEqual(value, expected))
        : false;
    if (!included) assertionError(`expected ${formatLogValue(actual)} to include ${formatLogValue(expected)}`);
  };
  const property = (name: string, ...expectedValues: unknown[]) => {
    if (!actual || typeof actual !== 'object' || !Object.prototype.hasOwnProperty.call(actual, name)) {
      assertionError(`expected value to have property ${name}`);
    }
    if (expectedValues.length > 0 && !deepEqual((actual as Record<string, unknown>)[name], expectedValues[0])) {
      assertionError(`expected property ${name} to equal ${formatLogValue(expectedValues[0])}`);
    }
  };
  const above = (expected: number) => {
    if (typeof actual !== 'number' || actual <= expected) assertionError(`expected ${formatLogValue(actual)} to be above ${expected}`);
  };
  const below = (expected: number) => {
    if (typeof actual !== 'number' || actual >= expected) assertionError(`expected ${formatLogValue(actual)} to be below ${expected}`);
  };
  const oneOf = (expected: unknown[]) => {
    if (!expected.some((value) => deepEqual(actual, value))) assertionError(`expected ${formatLogValue(actual)} to be one of ${formatLogValue(expected)}`);
  };

  const be: Record<string, unknown> = { above, below, oneOf };
  Object.defineProperties(be, {
    ok: { get: () => { if (!actual) assertionError(`expected ${formatLogValue(actual)} to be truthy`); return true; } },
    true: { get: () => { if (actual !== true) assertionError(`expected ${formatLogValue(actual)} to be true`); return true; } },
    false: { get: () => { if (actual !== false) assertionError(`expected ${formatLogValue(actual)} to be false`); return true; } },
  });

  return {
    to: {
      equal,
      eql,
      include,
      match: (pattern: RegExp) => {
        if (typeof actual !== 'string' || !pattern.test(actual)) assertionError(`expected ${formatLogValue(actual)} to match ${pattern}`);
      },
      have: { property },
      be,
    },
  };
}

function pairIndex(entries: HttpKeyValue[], name: string): number {
  return entries.findIndex((entry) => entry.key.toLowerCase() === name.toLowerCase());
}

function createHeadersApi(draft: HttpRequestDraft) {
  const entries = () => draft.headers || (draft.headers = []);
  const set = (name: string, value: unknown): void => {
    const current = entries();
    const index = pairIndex(current, name);
    const next = { key: name, value: String(value), enabled: true };
    if (index >= 0) current[index] = next;
    else current.push(next);
  };
  return {
    get(name: string): string | undefined {
      const index = pairIndex(entries(), name);
      return index >= 0 ? entries()[index].value : undefined;
    },
    has(name: string): boolean { return pairIndex(entries(), name) >= 0; },
    set,
    upsert({ key, value }: { key: string; value: unknown }): void { set(key, value); },
    remove(name: string): void { draft.headers = entries().filter((entry) => entry.key.toLowerCase() !== name.toLowerCase()); },
    toObject(): Record<string, string> {
      const record: Record<string, string> = {};
      for (const entry of entries()) if (entry.enabled !== false) record[entry.key] = entry.value;
      return record;
    },
  };
}

function createResponseHeadersApi(headers: Array<[string, string]>) {
  return {
    get(name: string): string | undefined { return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]; },
    has(name: string): boolean { return headers.some(([key]) => key.toLowerCase() === name.toLowerCase()); },
    toObject(): Record<string, string> {
      const record: Record<string, string> = {};
      for (const [key, value] of headers) record[key] = value;
      return record;
    },
  };
}

export async function runApiClientScript(options: {
  script: string;
  phase: 'pre-request' | 'tests';
  draft: HttpRequestDraft;
  variables?: HttpVariables;
  environmentVariables?: HttpVariables;
  response?: ApiClientScriptResponse;
}): Promise<ApiClientScriptRunResult> {
  const draft = cloneDraft(options.draft);
  const variables = safeVariables(options.variables || {});
  const environmentVariables = safeVariables(options.environmentVariables || {});
  const environmentChanges: ApiClientScriptEnvironmentChange[] = [];
  const tests: ApiClientScriptTestResult[] = [];
  const logs: string[] = [];
  const pendingTests: Promise<void>[] = [];

  const environment = {
    get(key: string): string | undefined { return environmentVariables[key]; },
    has(key: string): boolean { return Object.prototype.hasOwnProperty.call(environmentVariables, key); },
    set(key: string, value: unknown): void {
      const stringValue = String(value);
      environmentVariables[key] = stringValue;
      variables[key] = stringValue;
      environmentChanges.push({ action: 'set', key, value: stringValue });
    },
    unset(key: string): void {
      delete environmentVariables[key];
      delete variables[key];
      environmentChanges.push({ action: 'unset', key });
    },
    replaceIn(value: string): string {
      return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawName: string) => {
        const name = rawName.trim();
        return Object.prototype.hasOwnProperty.call(environmentVariables, name) ? environmentVariables[name] : match;
      });
    },
  };

  const localVariables = {
    get(key: string): string | undefined { return variables[key]; },
    has(key: string): boolean { return Object.prototype.hasOwnProperty.call(variables, key); },
    set(key: string, value: unknown): void { variables[key] = String(value); },
    unset(key: string): void { delete variables[key]; },
    replaceIn(value: string): string {
      return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawName: string) => {
        const name = rawName.trim();
        return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
      });
    },
  };

  const requestBody = {
    get raw(): string { return draft.body || ''; },
    set raw(value: string) { draft.body = String(value); },
  };
  const request = {
    get method(): string { return draft.method; },
    set method(value: string) { draft.method = String(value); },
    get url(): string { return draft.url; },
    set url(value: string) { draft.url = String(value); },
    headers: createHeadersApi(draft),
    body: requestBody,
  };

  const response = options.response ? {
    code: options.response.status,
    status: options.response.statusText,
    responseTime: options.response.responseTime,
    headers: createResponseHeadersApi(options.response.headers),
    text: () => options.response?.body || '',
    json: () => JSON.parse(options.response?.body || ''),
  } : undefined;

  const flex = {
    request,
    response,
    environment,
    variables: localVariables,
    expect: createExpectation,
    test(name: string, callback: () => unknown | Promise<unknown>): void {
      if (options.phase !== 'tests') throw new Error('flex.test is only available in post-response test scripts.');
      const promise = Promise.resolve()
        .then(callback)
        .then(() => { tests.push({ name, passed: true }); })
        .catch((cause) => { tests.push({ name, passed: false, error: cause instanceof Error ? cause.message : String(cause) }); });
      pendingTests.push(promise);
    },
  };

  const scriptConsole = {
    log: (...values: unknown[]) => logs.push(values.map(formatLogValue).join(' ')),
    info: (...values: unknown[]) => logs.push(values.map(formatLogValue).join(' ')),
    warn: (...values: unknown[]) => logs.push(`WARN ${values.map(formatLogValue).join(' ')}`),
    error: (...values: unknown[]) => logs.push(`ERROR ${values.map(formatLogValue).join(' ')}`),
  };

  try {
    // Request scripts are intentionally trusted local JavaScript, matching the API-client use case.
    // The package documentation calls out that this is not a security sandbox.
    type FlexApi = typeof flex;
    type ScriptConsole = typeof scriptConsole;
    const execute = new Function('flex', 'console', `"use strict"; return (async () => {\n${options.script}\n})();`) as (api: FlexApi, logger: ScriptConsole) => Promise<void>;
    await execute(flex, scriptConsole);
    await Promise.all(pendingTests);
    return { draft, variables, environmentVariables, environmentChanges, tests, logs };
  } catch (cause) {
    await Promise.all(pendingTests);
    return {
      draft,
      variables,
      environmentVariables,
      environmentChanges,
      tests,
      logs,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
