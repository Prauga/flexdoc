import type { HttpAuth, HttpKeyValue, HttpRequestDraft } from './http-client';
import { cloneApiClientScripts } from './api-client-scripting';
import type { ApiClientRequestScripts } from './api-client-scripting';

export interface ApiClientCollection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientFolder {
  id: string;
  collectionId: string;
  name: string;
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

export interface ApiClientEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled?: boolean;
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
  request: HttpRequestDraft;
  scripts?: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
  createdAt: string;
}

export interface ApiClientHistoryInput {
  request: HttpRequestDraft;
  scripts?: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
}

export interface ApiClientWorkspaceState {
  version: 4;
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
  if (value.type === 'none') return true;
  if (value.type === 'bearer') return hasString(value, 'token');
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

function isCollection(value: unknown): value is ApiClientCollection {
  return isRecord(value)
    && hasString(value, 'id')
    && hasString(value, 'name')
    && hasString(value, 'createdAt')
    && hasString(value, 'updatedAt');
}

function isFolder(value: unknown): value is ApiClientFolder {
  return isRecord(value)
    && hasString(value, 'id')
    && hasString(value, 'collectionId')
    && hasString(value, 'name')
    && hasString(value, 'createdAt')
    && hasString(value, 'updatedAt');
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

function isEnvironmentVariable(value: unknown): value is ApiClientEnvironmentVariable {
  return isRecord(value)
    && hasString(value, 'id')
    && hasString(value, 'key')
    && hasString(value, 'value')
    && (value.enabled === undefined || typeof value.enabled === 'boolean');
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
    || !hasString(value, 'createdAt')) return null;

  const scripts = normalizeScripts(value.scripts);
  return {
    id: value.id as string,
    request: value.request,
    ...(scripts ? { scripts } : {}),
    executedMethod: value.executedMethod as string,
    resolvedUrl: value.resolvedUrl as string,
    status: value.status as number | undefined,
    statusText: value.statusText as string | undefined,
    responseTime: value.responseTime as number | undefined,
    error: value.error as string | undefined,
    createdAt: value.createdAt as string,
  };
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
    version: 4,
    collections: [{ id: createApiClientId('collection'), name: DEFAULT_COLLECTION_NAME, createdAt: timestamp, updatedAt: timestamp }],
    folders: [],
    requests: [],
    environments: [],
    history: [],
  };
}

export function normalizeApiClientWorkspace(value: unknown): ApiClientWorkspaceState {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4)) return createDefaultApiClientWorkspace();

  const collectionValues = Array.isArray(value.collections) ? value.collections.filter(isCollection) : [];
  if (collectionValues.length === 0) return createDefaultApiClientWorkspace();
  const collectionIds = new Set(collectionValues.map((collection) => collection.id));

  const folderValues = (Array.isArray(value.folders) ? value.folders.filter(isFolder) : [])
    .filter((folder) => collectionIds.has(folder.collectionId));
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
      version: 4,
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
  const historyValues = value.version === 4 && Array.isArray(value.history)
    ? value.history
      .map(normalizeHistoryEntry)
      .filter((entry): entry is ApiClientHistoryEntry => entry !== null)
      .slice(0, HISTORY_LIMIT)
    : [];

  return {
    version: 4,
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
    request: cloneRequestDraft(input.request),
    ...(input.scripts ? { scripts: cloneApiClientScripts(input.scripts) } : {}),
    executedMethod: input.executedMethod,
    resolvedUrl: input.resolvedUrl,
    status: input.status,
    statusText: input.statusText,
    responseTime: input.responseTime,
    error: input.error,
    createdAt: now(),
  };
  return { ...workspace, history: [entry, ...workspace.history].slice(0, HISTORY_LIMIT) };
}

export function activeApiClientEnvironmentVariables(workspace: ApiClientWorkspaceState): Record<string, string> {
  const environment = workspace.environments.find((candidate) => candidate.id === workspace.activeEnvironmentId);
  const variables = Object.create(null) as Record<string, string>;
  if (!environment) return variables;
  for (const variable of environment.variables) {
    const key = variable.key.trim();
    if (variable.enabled === false || !key) continue;
    variables[key] = variable.value;
  }
  return variables;
}

export function deleteApiClientEnvironment(workspace: ApiClientWorkspaceState, environmentId: string): ApiClientWorkspaceState {
  return {
    ...workspace,
    environments: workspace.environments.filter((environment) => environment.id !== environmentId),
    activeEnvironmentId: workspace.activeEnvironmentId === environmentId ? undefined : workspace.activeEnvironmentId,
  };
}

export function deleteApiClientFolder(workspace: ApiClientWorkspaceState, folderId: string): ApiClientWorkspaceState {
  return {
    ...workspace,
    folders: workspace.folders.filter((folder) => folder.id !== folderId),
    requests: workspace.requests.map((request) => request.folderId === folderId ? { ...request, folderId: undefined, updatedAt: now() } : request),
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
