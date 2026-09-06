import { buildHttpRequest } from './http-client';
import { cloneApiClientScripts, runApiClientScript } from './api-client-scripting';
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
  onRequestBuilt?: (request: BuiltRequest) => void;
  onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  fetcher?: typeof globalThis.fetch;
  now?: () => number;
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
    auth,
  };
}

function safeVariables(values: HttpVariables | undefined): HttpVariables {
  return Object.assign(Object.create(null) as HttpVariables, values || {});
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Request failed';
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
    const request = buildHttpRequest(executionDraft, { variables: executionVariables });
    executedMethod = request.method;
    resolvedUrl = request.url;
    options.onRequestBuilt?.(request);

    let initWithUrl: RequestInit & { url: string } = {
      ...request.init,
      url: request.url,
      credentials: options.credentials || 'same-origin',
    };
    if (options.requestInterceptor) initWithUrl = await options.requestInterceptor(initWithUrl);
    const { url, ...init } = initWithUrl;
    resolvedUrl = url;
    startedAt = now();
    requestAttempted = true;
    if (!fetcher) throw new Error('Fetch API is not available');
    const response = await fetcher(url, init);
    const body = await response.text();
    const responseTime = now() - startedAt;
    const responseHeaders = [...response.headers.entries()];

    if (scripts.tests.trim()) {
      const testResult = await runApiClientScript({
        script: scripts.tests,
        phase: 'tests',
        draft: executionDraft,
        variables: executionVariables,
        collectionVariables: executionCollectionVariables,
        externalVariables: executionExternalVariables,
        environmentVariables: executionEnvironmentVariables,
        response: {
status: response.status,
statusText: response.statusText,
headers: responseHeaders,
body,
responseTime,
        },
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
      status: response.status,
      statusText: response.statusText,
      responseTime,
      responseHeaders: responseHeaders.map(([key, value]) => [key, value]),
      responseBody: body,
      ...(scriptTests.length ? { scriptTests } : {}),
      ...(logs.length ? { scriptLogs: [...logs] } : {}),
      ...(scriptError ? { scriptError } : {}),
    };
    return {
      result,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body,
        responseTime,
      },
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
