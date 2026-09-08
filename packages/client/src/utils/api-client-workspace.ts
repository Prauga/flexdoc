import type { HttpAuth, HttpBinaryBody, HttpFormDataEntry, HttpKeyValue, HttpRequestDraft } from './http-client';
import { cloneApiClientScripts } from './api-client-scripting';
import type { ApiClientRequestScripts, ApiClientScriptCollectionChange, ApiClientScriptEnvironmentChange, ApiClientScriptTestResult } from './api-client-scripting';

/** One named value stored in an API Client environment or collection variable list. */
export interface ApiClientEnvironmentVariable {
  /** Stable workspace-local variable id. */ id: string;
  /** Placeholder key referenced as `{{key}}`. */ key: string;
  /** String value substituted during request/script resolution. */ value: string;
  /** Whether the variable participates in resolution. Defaults to enabled. */ enabled?: boolean;
}

/** Collection metadata and variables for one API Client workspace collection. */
export interface ApiClientCollection {
  /** Stable workspace-local collection id. */ id: string;
  /** User-visible collection name. */ name: string;
  /** Authentication inherited by descendant folders/requests that use `inherit`. */ auth: HttpAuth;
  /** Collection-scoped variables available to requests/scripts. */ variables: ApiClientEnvironmentVariable[];
  /** ISO timestamp when the collection was created. */ createdAt: string;
  /** ISO timestamp when the collection was last modified. */ updatedAt: string;
}

/** Nested folder inside one API Client collection. */
export interface ApiClientFolder {
  /** Stable workspace-local folder id. */ id: string;
  /** Owning collection id. */ collectionId: string;
  /** Parent folder id for nested folders. */ parentFolderId?: string;
  /** User-visible folder name. */ name: string;
  /** Authentication inherited by descendant requests/folders when they use `inherit`. */ auth: HttpAuth;
  /** ISO timestamp when the folder was created. */ createdAt: string;
  /** ISO timestamp when the folder was last modified. */ updatedAt: string;
}

/** Persisted request stored in an API Client collection/folder. */
export interface ApiClientSavedRequest {
  /** Stable workspace-local request id. */ id: string;
  /** Owning collection id. */ collectionId: string;
  /** Containing folder id when the request is nested. */ folderId?: string;
  /** User-visible request name. */ name: string;
  /** Editable request draft persisted by the workspace. */ request: HttpRequestDraft;
  /** Optional pre-request/test scripts persisted with the request. */ scripts?: ApiClientRequestScripts;
  /** ISO timestamp when the saved request was created. */ createdAt: string;
  /** ISO timestamp when the saved request was last modified. */ updatedAt: string;
}

/** Named API Client environment containing variable values. */
export interface ApiClientEnvironment {
  /** Stable workspace-local environment id. */ id: string;
  /** User-visible environment name. */ name: string;
  /** Variables belonging to the environment. */ variables: ApiClientEnvironmentVariable[];
  /** ISO timestamp when the environment was created. */ createdAt: string;
  /** ISO timestamp when the environment was last modified. */ updatedAt: string;
}

/** Persisted execution-history record for one request. */
export interface ApiClientHistoryEntry {
  /** Stable history-entry id. */ id: string;
  /** Collection associated with the request when known. */ collectionId?: string;
  /** Folder associated with the request when known. */ folderId?: string;
  /** Request snapshot captured before execution. */ request: HttpRequestDraft;
  /** Script snapshot captured for the execution. */ scripts?: ApiClientRequestScripts;
  /** HTTP method actually executed. */ executedMethod: string;
  /** Fully resolved URL actually executed. */ resolvedUrl: string;
  /** HTTP response status when available. */ status?: number;
  /** HTTP response status text when available. */ statusText?: string;
  /** Measured response time in milliseconds. */ responseTime?: number;
  /** Ordered response headers retained in history. */ responseHeaders?: Array<[string, string]>;
  /** Response body retained up to the workspace history size cap. */ responseBody?: string;
  /** Whether the stored response body was truncated to the history size cap. */ responseBodyTruncated?: boolean;
  /** Collection-run id when the entry was produced by a runner. */ runId?: string;
  /** Collection-run display name. */ runName?: string;
  /** One-based request index within the run. */ runIndex?: number;
  /** Total selected request count for the run. */ runTotal?: number;
  /** Whether this run item passed transport/scripts/tests. */ runPassed?: boolean;
  /** Whether this run item was cancelled. */ runCancelled?: boolean;
  /** Transport/build error, if execution failed. */ error?: string;
  /** Test assertion results produced by the test script. */ scriptTests?: ApiClientScriptTestResult[];
  /** Captured script console output. */ scriptLogs?: string[];
  /** Top-level pre-request/test script error. */ scriptError?: string;
  /** ISO timestamp when the history entry was recorded. */ createdAt: string;
}

/** History-entry input accepted by `addApiClientHistoryEntry`; id/timestamp are generated internally. */
export interface ApiClientHistoryInput {
  /** Collection associated with the request when known. */ collectionId?: string;
  /** Folder associated with the request when known. */ folderId?: string;
  /** Request snapshot to record. */ request: HttpRequestDraft;
  /** Script snapshot to record. */ scripts?: ApiClientRequestScripts;
  /** HTTP method actually executed. */ executedMethod: string;
  /** Fully resolved URL actually executed. */ resolvedUrl: string;
  /** HTTP response status when available. */ status?: number;
  /** HTTP response status text when available. */ statusText?: string;
  /** Measured response time in milliseconds. */ responseTime?: number;
  /** Ordered response headers to retain. */ responseHeaders?: Array<[string, string]>;
  /** Response body to retain subject to the history size cap. */ responseBody?: string;
  /** Explicitly mark the supplied response body as already truncated. */ responseBodyTruncated?: boolean;
  /** Collection-run id when produced by a runner. */ runId?: string;
  /** Collection-run display name. */ runName?: string;
  /** One-based request index within the run. */ runIndex?: number;
  /** Total selected request count for the run. */ runTotal?: number;
  /** Whether this run item passed transport/scripts/tests. */ runPassed?: boolean;
  /** Whether this run item was cancelled. */ runCancelled?: boolean;
  /** Transport/build error, if execution failed. */ error?: string;
  /** Test assertion results to retain. */ scriptTests?: ApiClientScriptTestResult[];
  /** Captured script console output to retain. */ scriptLogs?: string[];
  /** Top-level pre-request/test script error. */ scriptError?: string;
}

/** In-memory API Client workspace state persisted to IndexedDB by default. */
export interface ApiClientWorkspaceState {
  /** Workspace schema version used for migration/normalization. */ version: 6;
  /** Top-level request collections. */ collections: ApiClientCollection[];
  /** Nested folders belonging to collections. */ folders: ApiClientFolder[];
  /** Saved requests belonging to collections/folders. */ requests: ApiClientSavedRequest[];
  /** Named variable environments. */ environments: ApiClientEnvironment[];
  /** Currently active environment id, when one is selected. */ activeEnvironmentId?: string;
  /** Most-recent-first execution history, capped by the workspace implementation. */ history: ApiClientHistoryEntry[];
}

const DATABASE_NAME = 'flexdoc-api-client';
const DATABASE_VERSION = 1;
const STORE_NAME = 'workspaces';
const DEFAULT_COLLECTION_NAME = 'My Collection';
const HISTORY_LIMIT = 100;
const HISTORY_RESPONSE_BODY_LIMIT = 256 * 1024;

type UnknownRecord = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasString(record: UnknownRecord, key: string): boolean {
  return typeof record[key] === 'string';
}

function isOptionalFiniteNumber(record: UnknownRecord, key: string): boolean {
  const value = record[key];
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isHttpKeyValue(value: unknown): value is HttpKeyValue {
  if (!isRecord(value) || !hasString(value, 'key') || !hasString(value, 'value')) return false;
  return value.enabled === undefined || typeof value.enabled === 'boolean';
}

function isHttpFormDataEntry(value: unknown): value is HttpFormDataEntry {
  if (!isHttpKeyValue(value)) return false;
  const entry = value as HttpFormDataEntry;
  if (entry.type !== undefined && entry.type !== 'text' && entry.type !== 'file') return false;
  if (entry.fileName !== undefined && typeof entry.fileName !== 'string') return false;
  if (entry.contentType !== undefined && typeof entry.contentType !== 'string') return false;
  if (entry.file !== undefined && typeof File !== 'undefined' && !(entry.file instanceof File)) return false;
  return true;
}

function isHttpBinaryBody(value: unknown): value is HttpBinaryBody {
  if (!isRecord(value)) return false;
  if (value.fileName !== undefined && typeof value.fileName !== 'string') return false;
  if (value.contentType !== undefined && typeof value.contentType !== 'string') return false;
  if (value.file !== undefined && typeof File !== 'undefined' && !(value.file instanceof File)) return false;
  return true;
}

function isHttpAuth(value: unknown): value is HttpAuth {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'none' || value.type === 'inherit') return true;
  if (value.type === 'bearer') return hasString(value, 'token');
  if (value.type === 'oauth2') {
    if (!hasString(value, 'accessToken')) return false;
    const grantTypes = new Set(['accessToken', 'authorizationCode', 'clientCredentials', 'password', 'implicit']);
    if (value.grantType !== undefined && (typeof value.grantType !== 'string' || !grantTypes.has(value.grantType))) return false;
    if (value.clientAuthentication !== undefined && value.clientAuthentication !== 'body' && value.clientAuthentication !== 'basic') return false;
    for (const key of ['authorizationUrl', 'tokenUrl', 'clientId', 'clientSecret', 'redirectUri', 'username', 'password', 'refreshToken']) if (value[key] !== undefined && typeof value[key] !== 'string') return false;
    return value.scopes === undefined || (Array.isArray(value.scopes) && value.scopes.every((scope) => typeof scope === 'string'));
  }
  if (value.type === 'basic' || value.type === 'digest') return hasString(value, 'username') && hasString(value, 'password');
  if (value.type === 'apiKey') return hasString(value, 'key') && hasString(value, 'value') && (value.in === 'header' || value.in === 'query' || value.in === 'cookie');
  if (value.type === 'hawk') return hasString(value, 'id') && hasString(value, 'key') && (value.algorithm === undefined || value.algorithm === 'sha1' || value.algorithm === 'sha256') && (value.ext === undefined || typeof value.ext === 'string');
  if (value.type === 'ntlm') return hasString(value, 'username') && hasString(value, 'password') && (value.domain === undefined || typeof value.domain === 'string') && (value.workstation === undefined || typeof value.workstation === 'string');
  if (value.type === 'oauth1') return hasString(value, 'consumerKey') && hasString(value, 'consumerSecret') && (value.token === undefined || typeof value.token === 'string') && (value.tokenSecret === undefined || typeof value.tokenSecret === 'string') && (value.realm === undefined || typeof value.realm === 'string') && (value.signatureMethod === undefined || ['HMAC-SHA1', 'HMAC-SHA256', 'PLAINTEXT'].includes(String(value.signatureMethod)));
  if (value.type === 'awsv4') return hasString(value, 'accessKey') && hasString(value, 'secretKey') && hasString(value, 'region') && hasString(value, 'service') && (value.sessionToken === undefined || typeof value.sessionToken === 'string');
  return false;
}

function isHttpRequestDraft(value: unknown): value is HttpRequestDraft {
  if (!isRecord(value) || !hasString(value, 'method') || !hasString(value, 'url')) return false;
  if (value.query !== undefined && (!Array.isArray(value.query) || !value.query.every(isHttpKeyValue))) return false;
  if (value.headers !== undefined && (!Array.isArray(value.headers) || !value.headers.every(isHttpKeyValue))) return false;
  if (value.body !== undefined && typeof value.body !== 'string') return false;
  if (value.contentType !== undefined && typeof value.contentType !== 'string') return false;
  if (value.bodyMode !== undefined && !['none', 'raw', 'json', 'urlencoded', 'formdata', 'binary', 'graphql'].includes(String(value.bodyMode))) return false;
  if (value.urlencoded !== undefined && (!Array.isArray(value.urlencoded) || !value.urlencoded.every(isHttpKeyValue))) return false;
  if (value.formData !== undefined && (!Array.isArray(value.formData) || !value.formData.every(isHttpFormDataEntry))) return false;
  if (value.binary !== undefined && !isHttpBinaryBody(value.binary)) return false;
  if (value.graphql !== undefined && (!isRecord(value.graphql) || !hasString(value.graphql, 'query') || !hasString(value.graphql, 'variables'))) return false;
  if (value.hostExecution !== undefined && (!isRecord(value.hostExecution) || (value.hostExecution.certificateId !== undefined && typeof value.hostExecution.certificateId !== 'string') || (value.hostExecution.cookieJar !== undefined && value.hostExecution.cookieJar !== 'session'))) return false;
  return value.auth === undefined || isHttpAuth(value.auth);
}

function isEnvironmentVariable(value: unknown): value is ApiClientEnvironmentVariable {
  return isRecord(value)
    && hasString(value, 'id')
    && hasString(value, 'key')
    && hasString(value, 'value')
    && (value.enabled === undefined || typeof value.enabled === 'boolean');
}

function normalizeCollection(value: unknown): ApiClientCollection | null {
  if (!isRecord(value)
    || !hasString(value, 'id')
    || !hasString(value, 'name')
    || !hasString(value, 'createdAt')
    || !hasString(value, 'updatedAt')) return null;

  return {
    id: value.id as string,
    name: value.name as string,
    auth: isHttpAuth(value.auth) ? value.auth : { type: 'none' },
    variables: Array.isArray(value.variables) ? value.variables.filter(isEnvironmentVariable) : [],
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  };
}

function normalizeFolder(value: unknown): ApiClientFolder | null {
  if (!isRecord(value)
    || !hasString(value, 'id')
    || !hasString(value, 'collectionId')
    || (value.parentFolderId !== undefined && typeof value.parentFolderId !== 'string')
    || !hasString(value, 'name')
    || !hasString(value, 'createdAt')
    || !hasString(value, 'updatedAt')) return null;

  return {
    id: value.id as string,
    collectionId: value.collectionId as string,
    parentFolderId: value.parentFolderId as string | undefined,
    name: value.name as string,
    auth: isHttpAuth(value.auth) ? value.auth : { type: 'inherit' },
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  };
}

function normalizeFolderHierarchy(values: unknown[], collectionIds: Set<string>): ApiClientFolder[] {
  const folders = values
    .map(normalizeFolder)
    .filter((folder): folder is ApiClientFolder => folder !== null)
    .filter((folder) => collectionIds.has(folder.collectionId));
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  for (const folder of folders) {
    if (!folder.parentFolderId) continue;
    const parent = byId.get(folder.parentFolderId);
    if (!parent || parent.collectionId !== folder.collectionId || parent.id === folder.id) folder.parentFolderId = undefined;
  }

  for (const folder of folders) {
    if (!folder.parentFolderId) continue;
    const seen = new Set([folder.id]);
    let parentId: string | undefined = folder.parentFolderId;
    while (parentId) {
      if (seen.has(parentId)) {
        folder.parentFolderId = undefined;
        break;
      }
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentFolderId;
    }
  }

  return folders;
}

function normalizeScripts(value: unknown): ApiClientRequestScripts | undefined {
  if (!isRecord(value) || !hasString(value, 'preRequest') || !hasString(value, 'tests')) return undefined;
  return { preRequest: value.preRequest as string, tests: value.tests as string };
}

function normalizeSavedRequest(value: unknown): ApiClientSavedRequest | null {
  if (!isRecord(value)
    || !hasString(value, 'id')
    || !hasString(value, 'collectionId')
    || (value.folderId !== undefined && typeof value.folderId !== 'string')
    || !hasString(value, 'name')
    || !isHttpRequestDraft(value.request)
    || !hasString(value, 'createdAt')
    || !hasString(value, 'updatedAt')) return null;

  const scripts = normalizeScripts(value.scripts);
  return {
    id: value.id as string,
    collectionId: value.collectionId as string,
    folderId: value.folderId as string | undefined,
    name: value.name as string,
    request: cloneRequestDraft(value.request),
    ...(scripts ? { scripts } : {}),
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  };
}

function normalizeEnvironment(value: unknown): ApiClientEnvironment | null {
  if (!isRecord(value)
    || !hasString(value, 'id')
    || !hasString(value, 'name')
    || !Array.isArray(value.variables)
    || !hasString(value, 'createdAt')
    || !hasString(value, 'updatedAt')) return null;

  return {
    id: value.id as string,
    name: value.name as string,
    variables: value.variables.filter(isEnvironmentVariable),
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  };
}

function isResponseHeader(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'string'
    && typeof value[1] === 'string';
}

function normalizeScriptTestResult(value: unknown): ApiClientScriptTestResult | null {
  if (!isRecord(value) || !hasString(value, 'name') || typeof value.passed !== 'boolean') return null;
  if (value.error !== undefined && typeof value.error !== 'string') return null;
  return {
    name: value.name as string,
    passed: value.passed as boolean,
    error: value.error as string | undefined,
  };
}

function normalizeHistoryEntry(value: unknown): ApiClientHistoryEntry | null {
  if (!isRecord(value)
    || !hasString(value, 'id')
    || !isHttpRequestDraft(value.request)
    || !hasString(value, 'executedMethod')
    || !hasString(value, 'resolvedUrl')
    || !isOptionalFiniteNumber(value, 'status')
    || (value.statusText !== undefined && typeof value.statusText !== 'string')
    || !isOptionalFiniteNumber(value, 'responseTime')
    || (value.responseHeaders !== undefined && (!Array.isArray(value.responseHeaders) || !value.responseHeaders.every(isResponseHeader)))
    || (value.responseBody !== undefined && typeof value.responseBody !== 'string')
    || (value.responseBodyTruncated !== undefined && typeof value.responseBodyTruncated !== 'boolean')
    || (value.runId !== undefined && typeof value.runId !== 'string')
    || (value.runName !== undefined && typeof value.runName !== 'string')
    || !isOptionalFiniteNumber(value, 'runIndex')
    || !isOptionalFiniteNumber(value, 'runTotal')
    || (value.runPassed !== undefined && typeof value.runPassed !== 'boolean')
    || (value.runCancelled !== undefined && typeof value.runCancelled !== 'boolean')
    || (value.error !== undefined && typeof value.error !== 'string')
    || (value.scriptError !== undefined && typeof value.scriptError !== 'string')
    || !hasString(value, 'createdAt')) return null;

  const scripts = normalizeScripts(value.scripts);
  const scriptTests = Array.isArray(value.scriptTests)
    ? value.scriptTests.map(normalizeScriptTestResult).filter((test): test is ApiClientScriptTestResult => test !== null)
    : [];
  const scriptLogs = Array.isArray(value.scriptLogs) ? value.scriptLogs.filter((log): log is string => typeof log === 'string') : [];
  return {
    id: value.id as string,
    collectionId: typeof value.collectionId === 'string' ? value.collectionId : undefined,
    folderId: typeof value.folderId === 'string' ? value.folderId : undefined,
    request: cloneRequestDraft(value.request),
    ...(scripts ? { scripts } : {}),
    executedMethod: value.executedMethod as string,
    resolvedUrl: value.resolvedUrl as string,
    status: value.status as number | undefined,
    statusText: value.statusText as string | undefined,
    responseTime: value.responseTime as number | undefined,
    responseHeaders: Array.isArray(value.responseHeaders) ? value.responseHeaders.map(([key, headerValue]) => [key, headerValue] as [string, string]) : undefined,
    responseBody: typeof value.responseBody === 'string' ? value.responseBody : undefined,
    responseBodyTruncated: value.responseBodyTruncated === true ? true : undefined,
    runId: typeof value.runId === 'string' ? value.runId : undefined,
    runName: typeof value.runName === 'string' ? value.runName : undefined,
    runIndex: typeof value.runIndex === 'number' ? value.runIndex : undefined,
    runTotal: typeof value.runTotal === 'number' ? value.runTotal : undefined,
    runPassed: typeof value.runPassed === 'boolean' ? value.runPassed : undefined,
    runCancelled: value.runCancelled === true ? true : undefined,
    error: value.error as string | undefined,
    ...(scriptTests.length ? { scriptTests } : {}),
    ...(scriptLogs.length ? { scriptLogs } : {}),
    scriptError: value.scriptError as string | undefined,
    createdAt: value.createdAt as string,
  };
}

function variableMap(values: ApiClientEnvironmentVariable[]): Record<string, string> {
  const variables = Object.create(null) as Record<string, string>;
  for (const variable of values) {
    const key = variable.key.trim();
    if (variable.enabled === false || !key) continue;
    variables[key] = variable.value;
  }
  return variables;
}

/**
 * Create a workspace-local id with a readable prefix.
 * @param prefix Entity prefix such as `collection`, `request`, or `history`.
 * @returns Prefix plus a UUID when available, otherwise a timestamp/random fallback.
 */
export function createApiClientId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create the default IndexedDB workspace key for a documentation host/title pair.
 * @param title API/documentation title used to scope persistence.
 * @param host Host name used to scope persistence.
 * @returns Deterministic encoded workspace persistence key.
 */
export function createDefaultApiClientPersistenceKey(title?: string, host?: string): string {
  const scopedHost = host?.trim() || 'unknown-host';
  const scopedTitle = title?.trim() || 'untitled';
  return `flexdoc:${encodeURIComponent(scopedHost)}:${encodeURIComponent(scopedTitle)}`;
}

/**
 * Deep-clone editable request state while removing non-persistable browser `File` objects.
 * @param request Request draft to clone.
 * @returns Independent request draft safe to store in workspace state/history.
 */
export function cloneRequestDraft(request: HttpRequestDraft): HttpRequestDraft {
  const auth = request.auth
    ? request.auth.type === 'oauth2'
      ? { ...request.auth, scopes: request.auth.scopes ? [...request.auth.scopes] : undefined }
      : { ...request.auth }
    : undefined;
  return {
    ...request,
    query: request.query?.map((entry) => ({ ...entry })),
    headers: request.headers?.map((entry) => ({ ...entry })),
    urlencoded: request.urlencoded?.map((entry) => ({ ...entry })),
    formData: request.formData?.map((entry) => ({ ...entry, file: undefined })),
    binary: request.binary ? { ...request.binary, file: undefined } : undefined,
    graphql: request.graphql ? { ...request.graphql } : undefined,
    auth,
    hostExecution: request.hostExecution ? { ...request.hostExecution } : undefined,
  };
}

/** Create an empty version-6 workspace containing the default collection. */
export function createDefaultApiClientWorkspace(): ApiClientWorkspaceState {
  const timestamp = now();
  return {
    version: 6,
    collections: [{ id: createApiClientId('collection'), name: DEFAULT_COLLECTION_NAME, auth: { type: 'none' }, variables: [], createdAt: timestamp, updatedAt: timestamp }],
    folders: [],
    requests: [],
    environments: [],
    history: [],
  };
}

/**
 * Validate/migrate unknown persisted workspace data into the current schema.
 * @param value Unknown IndexedDB/imported workspace value.
 * @returns Normalized version-6 workspace, or a default workspace when the value is invalid.
 */
export function normalizeApiClientWorkspace(value: unknown): ApiClientWorkspaceState {
  if (!isRecord(value) || ![1, 2, 3, 4, 5, 6].includes(value.version as number)) return createDefaultApiClientWorkspace();

  const collectionValues = (Array.isArray(value.collections) ? value.collections : [])
    .map(normalizeCollection)
    .filter((collection): collection is ApiClientCollection => collection !== null);
  if (collectionValues.length === 0) return createDefaultApiClientWorkspace();
  const collectionIds = new Set(collectionValues.map((collection) => collection.id));

  const folderValues = normalizeFolderHierarchy(Array.isArray(value.folders) ? value.folders : [], collectionIds);
  const foldersById = new Map(folderValues.map((folder) => [folder.id, folder]));

  const requestValues = (Array.isArray(value.requests) ? value.requests : [])
    .map(normalizeSavedRequest)
    .filter((request): request is ApiClientSavedRequest => request !== null)
    .filter((request) => collectionIds.has(request.collectionId))
    .map((request) => {
      if (!request.folderId) return request;
      const folder = foldersById.get(request.folderId);
      return folder?.collectionId === request.collectionId ? request : { ...request, folderId: undefined };
    });

  if (value.version === 1) {
    return {
      version: 6,
      collections: collectionValues,
      folders: folderValues,
      requests: requestValues,
      environments: [],
      history: [],
    };
  }

  const environmentValues = (Array.isArray(value.environments) ? value.environments : [])
    .map(normalizeEnvironment)
    .filter((environment): environment is ApiClientEnvironment => environment !== null);
  const activeEnvironmentId = typeof value.activeEnvironmentId === 'string'
    && environmentValues.some((environment) => environment.id === value.activeEnvironmentId)
    ? value.activeEnvironmentId
    : undefined;
  const historyValues = (value.version === 4 || value.version === 5 || value.version === 6) && Array.isArray(value.history)
    ? value.history
      .map(normalizeHistoryEntry)
      .filter((entry): entry is ApiClientHistoryEntry => entry !== null)
      .slice(0, HISTORY_LIMIT)
    : [];

  return {
    version: 6,
    collections: collectionValues,
    folders: folderValues,
    requests: requestValues,
    environments: environmentValues,
    activeEnvironmentId,
    history: historyValues,
  };
}

/**
 * Prepend one execution to history while cloning inputs and enforcing response/history caps.
 * @param workspace Workspace to update.
 * @param input History payload without generated id/timestamp.
 * @returns New workspace state with the history entry at the front.
 */
export function addApiClientHistoryEntry(workspace: ApiClientWorkspaceState, input: ApiClientHistoryInput): ApiClientWorkspaceState {
  const responseBody = input.responseBody === undefined ? undefined : input.responseBody.slice(0, HISTORY_RESPONSE_BODY_LIMIT);
  const responseBodyTruncated = input.responseBodyTruncated === true || (input.responseBody?.length || 0) > HISTORY_RESPONSE_BODY_LIMIT;
  const entry: ApiClientHistoryEntry = {
    id: createApiClientId('history'),
    collectionId: input.collectionId,
    folderId: input.folderId,
    request: cloneRequestDraft(input.request),
    ...(input.scripts ? { scripts: cloneApiClientScripts(input.scripts) } : {}),
    executedMethod: input.executedMethod,
    resolvedUrl: input.resolvedUrl,
    status: input.status,
    statusText: input.statusText,
    responseTime: input.responseTime,
    ...(input.responseHeaders?.length ? { responseHeaders: input.responseHeaders.map(([key, value]) => [key, value] as [string, string]) } : {}),
    ...(responseBody !== undefined ? { responseBody, ...(responseBodyTruncated ? { responseBodyTruncated: true } : {}) } : {}),
    runId: input.runId,
    runName: input.runName,
    runIndex: input.runIndex,
    runTotal: input.runTotal,
    runPassed: input.runPassed,
    ...(input.runCancelled ? { runCancelled: true } : {}),
    error: input.error,
    ...(input.scriptTests?.length ? { scriptTests: input.scriptTests.map((test) => ({ ...test })) } : {}),
    ...(input.scriptLogs?.length ? { scriptLogs: [...input.scriptLogs] } : {}),
    scriptError: input.scriptError,
    createdAt: now(),
  };
  return { ...workspace, history: [entry, ...workspace.history].slice(0, HISTORY_LIMIT) };
}

/**
 * Resolve request/folder/collection authentication inheritance.
 * @param workspace Workspace containing the auth hierarchy.
 * @param collectionId Owning collection id.
 * @param folderId Starting folder id when the request is nested.
 * @param requestAuth Request-level auth, defaulting to `none`.
 * @returns First non-`inherit` auth walking request → folder ancestors → collection, or `none`.
 */
export function resolveApiClientAuth(
  workspace: ApiClientWorkspaceState,
  collectionId?: string,
  folderId?: string,
  requestAuth: HttpAuth = { type: 'none' },
): HttpAuth {
  if (requestAuth.type !== 'inherit') return { ...requestAuth };

  const folderById = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const seen = new Set<string>();
  let folder = folderId ? folderById.get(folderId) : undefined;
  while (folder && folder.collectionId === collectionId && !seen.has(folder.id)) {
    seen.add(folder.id);
    if (folder.auth.type !== 'inherit') return { ...folder.auth };
    folder = folder.parentFolderId ? folderById.get(folder.parentFolderId) : undefined;
  }

  const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
  if (collection && collection.auth.type !== 'inherit') return { ...collection.auth };
  return { type: 'none' };
}

/** Return enabled variables for one collection as a simple key/value map. */
export function apiClientCollectionVariables(workspace: ApiClientWorkspaceState, collectionId?: string): Record<string, string> {
  const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
  return variableMap(collection?.variables || []);
}

/** Return enabled variables for the active environment as a simple key/value map. */
export function activeApiClientEnvironmentVariables(workspace: ApiClientWorkspaceState): Record<string, string> {
  const environment = workspace.environments.find((candidate) => candidate.id === workspace.activeEnvironmentId);
  return variableMap(environment?.variables || []);
}

/**
 * Apply script-emitted variable mutations to the active environment.
 * @param workspace Workspace to update.
 * @param changes Ordered set/unset mutations emitted by scripts.
 * @returns Original workspace when no effective change occurs, otherwise updated state.
 */
export function applyApiClientEnvironmentChanges(
  workspace: ApiClientWorkspaceState,
  changes: ApiClientScriptEnvironmentChange[],
): ApiClientWorkspaceState {
  if (!workspace.activeEnvironmentId || changes.length === 0) return workspace;
  const environmentIndex = workspace.environments.findIndex((environment) => environment.id === workspace.activeEnvironmentId);
  if (environmentIndex < 0) return workspace;

  const environment = workspace.environments[environmentIndex];
  let variables = environment.variables.map((variable) => ({ ...variable }));
  let changed = false;
  for (const change of changes) {
    const key = change.key.trim();
    if (!key) continue;
    if (change.action === 'unset') {
      const next = variables.filter((variable) => variable.key.trim() !== key);
      if (next.length !== variables.length) {
        variables = next;
        changed = true;
      }
      continue;
    }
    const indexes = variables
      .map((variable, index) => variable.key.trim() === key ? index : -1)
      .filter((index) => index >= 0);
    const value = change.value || '';
    if (indexes.length > 0) {
      const first = indexes[0];
      variables[first] = { ...variables[first], key, value, enabled: true };
      if (indexes.length > 1) variables = variables.filter((variable, index) => index === first || variable.key.trim() !== key);
    } else {
      variables.push({ id: createApiClientId('variable'), key, value, enabled: true });
    }
    changed = true;
  }
  if (!changed) return workspace;
  const environments = workspace.environments.map((candidate, index) => index === environmentIndex
    ? { ...candidate, variables, updatedAt: now() }
    : candidate);
  return { ...workspace, environments };
}

/**
 * Apply script-emitted variable mutations to one collection.
 * @param workspace Workspace to update.
 * @param collectionId Collection receiving the mutations.
 * @param changes Ordered set/unset mutations emitted by scripts.
 * @returns Original workspace when no effective change occurs, otherwise updated state.
 */
export function applyApiClientCollectionChanges(
  workspace: ApiClientWorkspaceState,
  collectionId: string | undefined,
  changes: ApiClientScriptCollectionChange[],
): ApiClientWorkspaceState {
  if (!collectionId || changes.length === 0) return workspace;
  const collectionIndex = workspace.collections.findIndex((collection) => collection.id === collectionId);
  if (collectionIndex < 0) return workspace;

  const collection = workspace.collections[collectionIndex];
  let variables = collection.variables.map((variable) => ({ ...variable }));
  let changed = false;
  for (const change of changes) {
    const key = change.key.trim();
    if (!key) continue;
    if (change.action === 'unset') {
      const next = variables.filter((variable) => variable.key.trim() !== key);
      if (next.length !== variables.length) {
        variables = next;
        changed = true;
      }
      continue;
    }
    const indexes = variables
      .map((variable, index) => variable.key.trim() === key ? index : -1)
      .filter((index) => index >= 0);
    const value = change.value || '';
    if (indexes.length > 0) {
      const first = indexes[0];
      variables[first] = { ...variables[first], key, value, enabled: true };
      if (indexes.length > 1) variables = variables.filter((variable, index) => index === first || variable.key.trim() !== key);
    } else {
      variables.push({ id: createApiClientId('variable'), key, value, enabled: true });
    }
    changed = true;
  }
  if (!changed) return workspace;
  const collections = workspace.collections.map((candidate, index) => index === collectionIndex
    ? { ...candidate, variables, updatedAt: now() }
    : candidate);
  return { ...workspace, collections };
}

/** Remove an environment and clear it as active when selected. */
export function deleteApiClientEnvironment(workspace: ApiClientWorkspaceState, environmentId: string): ApiClientWorkspaceState {
  return {
    ...workspace,
    environments: workspace.environments.filter((environment) => environment.id !== environmentId),
    activeEnvironmentId: workspace.activeEnvironmentId === environmentId ? undefined : workspace.activeEnvironmentId,
  };
}

/** Remove a folder while reparenting direct child folders/requests to the deleted folder's parent. */
export function deleteApiClientFolder(workspace: ApiClientWorkspaceState, folderId: string): ApiClientWorkspaceState {
  const folder = workspace.folders.find((candidate) => candidate.id === folderId);
  if (!folder) return workspace;
  const updatedAt = now();
  return {
    ...workspace,
    folders: workspace.folders
      .filter((candidate) => candidate.id !== folderId)
      .map((candidate) => candidate.parentFolderId === folderId
        ? { ...candidate, parentFolderId: folder.parentFolderId, updatedAt }
        : candidate),
    requests: workspace.requests.map((request) => request.folderId === folderId
      ? { ...request, folderId: folder.parentFolderId, updatedAt }
      : request),
  };
}

/** Remove a collection and all of its folders/requests, creating a default collection when it was the last one. */
export function deleteApiClientCollection(workspace: ApiClientWorkspaceState, collectionId: string): ApiClientWorkspaceState {
  const remainingCollections = workspace.collections.filter((collection) => collection.id !== collectionId);
  if (remainingCollections.length === 0) {
    const replacement = createDefaultApiClientWorkspace();
    return {
      ...replacement,
      environments: workspace.environments,
      activeEnvironmentId: workspace.activeEnvironmentId,
      history: workspace.history,
    };
  }
  return {
    ...workspace,
    collections: remainingCollections,
    folders: workspace.folders.filter((folder) => folder.collectionId !== collectionId),
    requests: workspace.requests.filter((request) => request.collectionId !== collectionId),
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open FlexDoc API Client storage'));
  });
}

/**
 * Load and normalize one persisted workspace from IndexedDB.
 * @param key Workspace persistence key.
 * @returns Stored normalized workspace, or a default workspace when storage/data is unavailable.
 */
export async function loadApiClientWorkspace(key: string): Promise<ApiClientWorkspaceState> {
  const database = await openDatabase();
  if (!database) return createDefaultApiClientWorkspace();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(normalizeApiClientWorkspace(request.result));
      request.onerror = () => reject(request.error || new Error('Unable to load FlexDoc API Client workspace'));
    });
  } finally {
    database.close();
  }
}

/**
 * Persist a workspace under one IndexedDB key.
 * @param key Workspace persistence key.
 * @param workspace Version-6 workspace state to store.
 */
export async function saveApiClientWorkspace(key: string, workspace: ApiClientWorkspaceState): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(workspace, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save FlexDoc API Client workspace'));
      transaction.onabort = () => reject(transaction.error || new Error('Unable to save FlexDoc API Client workspace'));
    });
  } finally {
    database.close();
  }
}
