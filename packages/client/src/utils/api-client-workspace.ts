import type { HttpRequestDraft } from './http-client';

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

export interface ApiClientWorkspaceState {
  version: 2;
  collections: ApiClientCollection[];
  folders: ApiClientFolder[];
  requests: ApiClientSavedRequest[];
  environments: ApiClientEnvironment[];
  activeEnvironmentId?: string;
}

interface ApiClientWorkspaceStateV1 {
  version: 1;
  collections: ApiClientCollection[];
  folders: ApiClientFolder[];
  requests: ApiClientSavedRequest[];
}

const DATABASE_NAME = 'flexdoc-api-client';
const DATABASE_VERSION = 1;
const STORE_NAME = 'workspaces';
const DEFAULT_COLLECTION_NAME = 'My Collection';

function now(): string {
  return new Date().toISOString();
}

export function createApiClientId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    version: 2,
    collections: [{ id: createApiClientId('collection'), name: DEFAULT_COLLECTION_NAME, createdAt: timestamp, updatedAt: timestamp }],
    folders: [],
    requests: [],
    environments: [],
  };
}

function hasWorkspaceCollections(candidate: Partial<ApiClientWorkspaceState> | Partial<ApiClientWorkspaceStateV1>): boolean {
  return Array.isArray(candidate.collections) && Array.isArray(candidate.folders) && Array.isArray(candidate.requests) && candidate.collections.length > 0;
}

export function normalizeApiClientWorkspace(value: unknown): ApiClientWorkspaceState {
  if (!value || typeof value !== 'object') return createDefaultApiClientWorkspace();
  const candidate = value as Partial<ApiClientWorkspaceState> & Partial<ApiClientWorkspaceStateV1>;
  if (!hasWorkspaceCollections(candidate)) return createDefaultApiClientWorkspace();

  if (candidate.version === 1) {
    return {
      version: 2,
      collections: candidate.collections!,
      folders: candidate.folders!,
      requests: candidate.requests!,
      environments: [],
    };
  }

  if (candidate.version !== 2 || !Array.isArray(candidate.environments)) return createDefaultApiClientWorkspace();
  const activeEnvironmentId = candidate.environments.some((environment) => environment.id === candidate.activeEnvironmentId)
    ? candidate.activeEnvironmentId
    : undefined;
  return {
    version: 2,
    collections: candidate.collections!,
    folders: candidate.folders!,
    requests: candidate.requests!,
    environments: candidate.environments,
    activeEnvironmentId,
  };
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
