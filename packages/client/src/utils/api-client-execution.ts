import { buildHttpRequest, httpHostExecutionRequirements, resolveHttpRequestDraftVariables } from './http-client';
import { cloneApiClientScripts, runApiClientScript } from './api-client-scripting';
import type { FlexDocHostExecutionPublicOptions } from '../types/options';
import type { HttpAuth, HttpRequestDraft, HttpVariables } from './http-client';
import type {
  ApiClientRequestScripts,
  ApiClientScriptCollectionChange,
  ApiClientScriptEnvironmentChange,
  ApiClientScriptTestResult,
} from './api-client-scripting';
import type { BuiltRequest } from './request-builder';

export interface ApiClientExecutionResult {
  request: HttpRequestDraft;
  scripts: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  responseHeaders?: Array<[string, string]>;
  responseBody?: string;
  error?: string;
  scriptTests?: ApiClientScriptTestResult[];
  scriptLogs?: string[];
  scriptError?: string;
}

export interface ApiClientExecutionResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
  responseTime: number;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string; httpOnly?: boolean }>;
}

export interface ApiClientExecutionOutcome {
  result?: ApiClientExecutionResult;
  response?: ApiClientExecutionResponse;
  error?: string;
  scriptError?: string;
  scriptTests: ApiClientScriptTestResult[];
  scriptLogs: string[];
}

export interface ExecuteApiClientRequestOptions {
  request: HttpRequestDraft;
  scripts?: Partial<ApiClientRequestScripts>;
  credentials?: RequestCredentials;
  requestInterceptor?: (request: RequestInit & { url: string }) => RequestInit & { url: string } | Promise<RequestInit & { url: string }>;
  resolveAuth?: (auth: HttpAuth | undefined) => HttpAuth;
  variables?: HttpVariables;
  collectionVariables?: HttpVariables;
  externalVariables?: HttpVariables;
  environmentVariables?: HttpVariables;
  hostExecution?: FlexDocHostExecutionPublicOptions;
  onRequestBuilt?: (request: BuiltRequest) => void;
  onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  fetcher?: typeof globalThis.fetch;
  now?: () => number;
  signal?: AbortSignal;
}

function cloneDraft(draft: HttpRequestDraft): HttpRequestDraft {
  const auth = draft.auth
    ? draft.auth.type === 'oauth2'
      ? { ...draft.auth, scopes: draft.auth.scopes ? [...draft.auth.scopes] : undefined }
      : { ...draft.auth }
    : undefined;
  return {
    ...draft,
    query: draft.query?.map((entry) => ({ ...entry })),
    headers: draft.headers?.map((entry) => ({ ...entry })),
    urlencoded: draft.urlencoded?.map((entry) => ({ ...entry })),
    formData: draft.formData?.map((entry) => ({ ...entry })),
    binary: draft.binary ? { ...draft.binary } : undefined,
    graphql: draft.graphql ? { ...draft.graphql } : undefined,
    auth,
    hostExecution: draft.hostExecution ? { ...draft.hostExecution } : undefined,
  };
}

function serializableDraft(draft: HttpRequestDraft): HttpRequestDraft {
  const copy = cloneDraft(draft);
  if (copy.binary) copy.binary = { fileName: copy.binary.fileName, contentType: copy.binary.contentType };
  if (copy.formData) copy.formData = copy.formData.map((entry) => { const next = { ...entry }; delete next.file; return next; });
  return copy;
}

function safeVariables(values: HttpVariables | undefined): HttpVariables {
  return Object.assign(Object.create(null) as HttpVariables, values || {});
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Request failed';
}

function hostUnavailableMessage(missing: string[], hostExecution: FlexDocHostExecutionPublicOptions | undefined): string {
  if (!hostExecution?.available) return 'Host execution is disabled on this documentation server.';
  return `The API host does not support the required capability${missing.length === 1 ? '' : 'ies'}: ${missing.join(', ')}.`;
}

function base64FromBytes(bytes: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') throw new Error('Host execution binary uploads require a Base64 encoder.');
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return globalThis.btoa(binary);
}

async function hostExecutionBody(draft: HttpRequestDraft): Promise<{ body: BodyInit; headers: HeadersInit }> {
  const envelope: Record<string, unknown> = {
    request: serializableDraft(draft),
    ...(draft.hostExecution?.certificateId ? { certificateId: draft.hostExecution.certificateId } : {}),
    ...(draft.hostExecution?.cookieJar ? { cookieJar: draft.hostExecution.cookieJar } : {}),
  };

  if (draft.bodyMode === 'binary' && draft.binary?.file) {
    envelope.bodyBase64 = base64FromBytes(new Uint8Array(await draft.binary.file.arrayBuffer()));
  }

  const fileRows = (draft.formData || [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.enabled !== false && entry.type === 'file' && !!entry.file);
  if (fileRows.length > 0) {
    if (typeof FormData === 'undefined') throw new Error('Host multipart execution requires FormData support.');
    const form = new FormData();
    form.append('descriptor', JSON.stringify(envelope));
    for (const { entry, index } of fileRows) {
      const file = entry.file as File;
      form.append(`formData[${index}]`, file, entry.fileName || file.name);
    }
    return { body: form, headers: { 'X-FlexDoc-Execute': '1' } };
  }

  return {
    body: JSON.stringify(envelope),
    headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
  };
}

export async function executeApiClientRequest(options: ExecuteApiClientRequestOptions): Promise<ApiClientExecutionOutcome> {
  const historyRequest = cloneDraft(options.request);
  const scripts = cloneApiClientScripts(options.scripts);
  const fetcher = options.fetcher || globalThis.fetch;
  const now = options.now || Date.now;
  let executionDraft = cloneDraft(options.request);
  let executionVariables = safeVariables(options.variables);
  let executionCollectionVariables = safeVariables(options.collectionVariables);
  const executionExternalVariables = safeVariables(options.externalVariables);
  let executionEnvironmentVariables = safeVariables(options.environmentVariables);
  let logs: string[] = [];
  let scriptTests: ApiClientScriptTestResult[] = [];
  let scriptError: string | undefined;
  let executedMethod = '';
  let resolvedUrl = '';
  let startedAt = 0;
  let requestAttempted = false;

  try {
    if (scripts.preRequest.trim()) {
      const preRequestResult = await runApiClientScript({
        script: scripts.preRequest,
        phase: 'pre-request',
        draft: executionDraft,
        variables: executionVariables,
        collectionVariables: executionCollectionVariables,
        externalVariables: executionExternalVariables,
        environmentVariables: executionEnvironmentVariables,
      });
      executionDraft = preRequestResult.draft;
      executionVariables = preRequestResult.variables;
      executionCollectionVariables = preRequestResult.collectionVariables;
      executionEnvironmentVariables = preRequestResult.environmentVariables;
      logs = [...logs, ...preRequestResult.logs];
      if (preRequestResult.collectionChanges.length > 0) options.onCollectionChanges?.(preRequestResult.collectionChanges);
      if (preRequestResult.environmentChanges.length > 0) options.onEnvironmentChanges?.(preRequestResult.environmentChanges);
      if (preRequestResult.error) {
        return {
          scriptTests,
          scriptLogs: logs,
          scriptError: `Pre-request script: ${preRequestResult.error}`,
        };
      }
    }

    if (options.resolveAuth) executionDraft = { ...executionDraft, auth: options.resolveAuth(executionDraft.auth) };
    executionDraft = resolveHttpRequestDraftVariables(executionDraft, executionVariables);
    executedMethod = (executionDraft.method || 'GET').toUpperCase();
    resolvedUrl = executionDraft.url;

    const requirements = httpHostExecutionRequirements(executionDraft);
    let apiResponse: ApiClientExecutionResponse;

    if (requirements.length > 0) {
      const capabilities = new Set(options.hostExecution?.capabilities || []);
      const missing = requirements.filter((requirement) => !capabilities.has(requirement));
      if (!options.hostExecution?.available || missing.length > 0) {
        const error = hostUnavailableMessage(missing, options.hostExecution);
        return {
          error,
          result: {
            request: historyRequest,
            scripts,
            executedMethod,
            resolvedUrl,
            error,
            ...(logs.length ? { scriptLogs: [...logs] } : {}),
          },
          scriptTests,
          scriptLogs: logs,
        };
      }
      if (!fetcher) throw new Error('Fetch API is not available');
      const payload = await hostExecutionBody(executionDraft);
      startedAt = now();
      requestAttempted = true;
      const hostResponse = await fetcher(options.hostExecution.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: payload.headers,
        body: payload.body,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      const raw = await hostResponse.text();
      let snapshot: Record<string, unknown>;
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
        snapshot = parsed as Record<string, unknown>;
      } catch { throw new Error('API host returned an invalid execution response.'); }
      const hostError = typeof snapshot.error === 'string' ? snapshot.error : undefined;
      if (!hostResponse.ok) throw new Error(hostError || `API host execution failed with HTTP ${hostResponse.status}.`);
      if (typeof snapshot.status !== 'number' || !Array.isArray(snapshot.headers)) throw new Error('API host returned an invalid execution response.');
      const responseHeaders = snapshot.headers.map((entry: unknown) => Array.isArray(entry) ? [String(entry[0]), String(entry[1])] as [string, string] : ['', ''] as [string, string]).filter(([key]) => !!key);
      const cookies = Array.isArray(snapshot.cookies) ? snapshot.cookies as NonNullable<ApiClientExecutionResponse['cookies']> : undefined;
      apiResponse = {
        status: snapshot.status,
        statusText: String(snapshot.statusText || ''),
        headers: responseHeaders,
        body: String(snapshot.body || ''),
        responseTime: typeof snapshot.responseTime === 'number' ? snapshot.responseTime : now() - startedAt,
        ...(cookies ? { cookies } : {}),
      };
    } else {
      const request = buildHttpRequest(executionDraft);
      executedMethod = request.method;
      resolvedUrl = request.url;
      options.onRequestBuilt?.(request);

      let initWithUrl: RequestInit & { url: string } = {
        ...request.init,
        url: request.url,
        credentials: options.credentials || 'same-origin',
        ...(options.signal ? { signal: options.signal } : {}),
      };
      if (options.requestInterceptor) initWithUrl = await options.requestInterceptor(initWithUrl);
      if (options.signal) initWithUrl.signal = options.signal;
      const { url, ...init } = initWithUrl;
      resolvedUrl = url;
      startedAt = now();
      requestAttempted = true;
      if (!fetcher) throw new Error('Fetch API is not available');
      const response = await fetcher(url, init);
      const body = await response.text();
      apiResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        body,
        responseTime: now() - startedAt,
      };
    }

    if (scripts.tests.trim()) {
      const testResult = await runApiClientScript({
        script: scripts.tests,
        phase: 'tests',
        draft: executionDraft,
        variables: executionVariables,
        collectionVariables: executionCollectionVariables,
        externalVariables: executionExternalVariables,
        environmentVariables: executionEnvironmentVariables,
        response: apiResponse,
      });
      logs = [...logs, ...testResult.logs];
      scriptTests = testResult.tests.map((test) => ({ ...test }));
      if (testResult.collectionChanges.length > 0) options.onCollectionChanges?.(testResult.collectionChanges);
      if (testResult.environmentChanges.length > 0) options.onEnvironmentChanges?.(testResult.environmentChanges);
      if (testResult.error) scriptError = `Test script: ${testResult.error}`;
    }

    const result: ApiClientExecutionResult = {
      request: historyRequest,
      scripts,
      executedMethod,
      resolvedUrl,
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      responseTime: apiResponse.responseTime,
      responseHeaders: apiResponse.headers.map(([key, value]) => [key, value]),
      responseBody: apiResponse.body,
      ...(scriptTests.length ? { scriptTests } : {}),
      ...(logs.length ? { scriptLogs: [...logs] } : {}),
      ...(scriptError ? { scriptError } : {}),
    };
    return {
      result,
      response: apiResponse,
      scriptTests,
      scriptLogs: logs,
      ...(scriptError ? { scriptError } : {}),
    };
  } catch (cause) {
    const error = messageFor(cause);
    const outcome: ApiClientExecutionOutcome = {
      error,
      scriptTests,
      scriptLogs: logs,
    };
    if (!requestAttempted) return outcome;
    outcome.result = {
      request: historyRequest,
      scripts,
      executedMethod,
      resolvedUrl,
      responseTime: startedAt ? now() - startedAt : undefined,
      error,
      ...(logs.length ? { scriptLogs: [...logs] } : {}),
    };
    return outcome;
  }
}
