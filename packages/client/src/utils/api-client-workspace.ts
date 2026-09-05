import type { HttpAuth, HttpKeyValue, HttpRequestDraft } from './http-client';
import { cloneApiClientScripts } from './api-client-scripting';
import type { ApiClientRequestScripts, ApiClientScriptTestResult } from './api-client-scripting';

export interface ApiClientEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled?: boolean;
}

export interface ApiClientCollection {
  id: string;
  name: string;
  auth: HttpAuth;
  variables: ApiClientEnvironmentVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientFolder {
  id: string;
  collectionId: string;
  parentFolderId?: string;
  name: string;
  auth: HttpAuth;
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientSavedRequest {
  id: string;
  collectionId: string;
  folderId?: string;
  name: string;
  request: HttpRequestDraft;
  scripts?: ApiClientRequestScripts;
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientEnvironment {
  id: string;
  name: string;
  variables: ApiClientEnvironmentVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientHistoryEntry {
  id: string;
  collectionId?: string;
  folderId?: string;
  request: HttpRequestDraft;
  scripts?: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
  scriptTests?: ApiClientScriptTestResult[];
  scriptLogs?: string[];
  scriptError?: string;
  createdAt: string;
}

export interface ApiClientHistoryInput {
  collectionId?: string;
  folderId?: string;
  request: HttpRequestDraft;
  scripts?: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
  scriptTests?: ApiClientScriptTestResult[];
  scriptLogs?: string[];
  scriptError?: string;
}

export interface ApiClientWorkspaceState {
  version: 6;
  collections: ApiClientCollection[];
  folders: ApiClientFolder[];
  requests: ApiClientSavedRequest[];
  environments: ApiClientEnvironment[];
  activeEnvironmentId?: string;
  history: ApiClientHistoryEntry[];
}

const DATABASE_NAME = 'flexdoc-api-client';
const DATABASE_VERSION = 1;
const STORE_NAME = 'workspaces';
const DEFAULT_COLLECTION_NAME = 'My Collection';
const HISTORY_LIMIT = 100;

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

function isHttpAuth(value: unknown): value is HttpAuth {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'none' || value.type === 'inherit') return true;
  if (value.type === 'bearer') return hasString(value, 'token');
  if (value.type === 'oauth2') return hasString(value, 'accessToken');
  if (value.type === 'basic') return hasString(value, 'username') && hasString(value, 'password');
  return value.type === 'apiKey'
    && hasString(value, 'key')
    && hasString(value, 'value')
    && (value.in === 'header' || value.in === 'query');
}

function isHttpRequestDraft(value: unknown): value is HttpRequestDraft {
  if (!isRecord(value) || !hasString(value, 'method') || !hasString(value, 'url')) return false;
  if (value.query !== undefined && (!Array.isArray(value.query) || !value.query.every(isHttpKeyValue))) return false;
  if (value.headers !== undefined && (!Array.isArray(value.headers) || !value.headers.every(isHttpKeyValue))) return false;
  if (value.body !== undefined && typeof value.body !== 'string') return false;
  if (value.contentType !== undefined && typeof value.contentType !== 'string') return false;
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
    request: value.request,
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
    request: value.request,
    ...(scripts ? { scripts } : {}),
    executedMethod: value.executedMethod as string,
    resolvedUrl: value.resolvedUrl as string,
    status: value.status as number | undefined,
    statusText: value.statusText as string | undefined,
    responseTime: value.responseTime as number | undefined,
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

export function createApiClientId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultApiClientPersistenceKey(title?: string, host?: string): string {
  const scopedHost = host?.trim() || 'unknown-host';
  const scopedTitle = title?.trim() || 'untitled';
  return `flexdoc:${encodeURIComponent(scopedHost)}:${encodeURIComponent(scopedTitle)}`;
}

export function cloneRequestDraft(request: HttpRequestDraft): HttpRequestDraft {
  return {
    ...request,
    query: request.query?.map((entry) => ({ ...entry })),
    headers: request.headers?.map((entry) => ({ ...entry })),
    auth: request.auth ? { ...request.auth } : undefined,
  };
}

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

export function addApiClientHistoryEntry(workspace: ApiClientWorkspaceState, input: ApiClientHistoryInput): ApiClientWorkspaceState {
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
    error: input.error,
    ...(input.scriptTests?.length ? { scriptTests: input.scriptTests.map((test) => ({ ...test })) } : {}),
    ...(input.scriptLogs?.length ? { scriptLogs: [...input.scriptLogs] } : {}),
    scriptError: input.scriptError,
    createdAt: now(),
  };
  return { ...workspace, history: [entry, ...workspace.history].slice(0, HISTORY_LIMIT) };
}


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

export function apiClientCollectionVariables(workspace: ApiClientWorkspaceState, collectionId?: string): Record<string, string> {
  const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
  return variableMap(collection?.variables || []);
}

export function activeApiClientEnvironmentVariables(workspace: ApiClientWorkspaceState): Record<string, string> {
  const environment = workspace.environments.find((candidate) => candidate.id === workspace.activeEnvironmentId);
  return variableMap(environment?.variables || []);
}

export function deleteApiClientEnvironment(workspace: ApiClientWorkspaceState, environmentId: string): ApiClientWorkspaceState {
  return {
    ...workspace,
    environments: workspace.environments.filter((environment) => environment.id !== environmentId),
    activeEnvironmentId: workspace.activeEnvironmentId === environmentId ? undefined : workspace.activeEnvironmentId,
  };
}

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
