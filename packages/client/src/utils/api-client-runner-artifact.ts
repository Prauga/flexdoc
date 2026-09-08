import type { HttpAuth } from './http-client';
import { cloneApiClientScripts } from './api-client-scripting';
import {
  cloneRequestDraft,
  normalizeApiClientWorkspace,
} from './api-client-workspace';
import type {
  ApiClientCollection,
  ApiClientEnvironment,
  ApiClientFolder,
  ApiClientSavedRequest,
  ApiClientWorkspaceState,
} from './api-client-workspace';

/** Stable discriminator for portable FlexDoc Runner artifacts. */
export const API_CLIENT_RUNNER_ARTIFACT_KIND = 'flexdoc-runner' as const;
/** Current portable Runner artifact schema version. */
export const API_CLIENT_RUNNER_ARTIFACT_VERSION = 1 as const;

/** Workspace scope selected for a portable headless Runner artifact. */
export type ApiClientRunnerArtifactScope =
  | { type: 'collection'; collectionId: string }
  | { type: 'folder'; collectionId: string; folderId: string }
  | { type: 'request'; collectionId: string; requestId: string };

/**
 * Portable, history-free snapshot consumed by the 3.2 headless Runner.
 *
 * The artifact deliberately embeds the canonical workspace entities instead of
 * defining a second request/collection model. Only the selected collection scope
 * and selected environment are retained.
 */
export interface ApiClientRunnerArtifact {
  kind: typeof API_CLIENT_RUNNER_ARTIFACT_KIND;
  version: typeof API_CLIENT_RUNNER_ARTIFACT_VERSION;
  exportedAt: string;
  scope: ApiClientRunnerArtifactScope;
  workspace: ApiClientWorkspaceState;
}

/** Options controlling portable Runner artifact creation. */
export interface ExportApiClientRunnerArtifactOptions {
  /** Environment to include. Omit to use the active workspace environment; false exports none. */
  environmentId?: string | false;
  /** Deterministic timestamp override for tests/callers. */
  exportedAt?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function cloneAuth(auth: HttpAuth): HttpAuth {
  if (auth.type === 'oauth2') return { ...auth, scopes: auth.scopes ? [...auth.scopes] : undefined };
  return { ...auth };
}

function cloneCollection(collection: ApiClientCollection): ApiClientCollection {
  return {
    ...collection,
    auth: cloneAuth(collection.auth),
    variables: collection.variables.map((variable) => ({ ...variable })),
  };
}

function cloneFolder(folder: ApiClientFolder): ApiClientFolder {
  return { ...folder, auth: cloneAuth(folder.auth) };
}

function assertPortableDraft(request: ApiClientSavedRequest): void {
  if (request.request.binary?.file) {
    throw new Error(`Request ${request.name} contains an in-memory binary file. Runner artifact file payload export is not supported yet.`);
  }
  if ((request.request.formData || []).some((entry) => entry.type === 'file' && !!entry.file)) {
    throw new Error(`Request ${request.name} contains an in-memory multipart file. Runner artifact file payload export is not supported yet.`);
  }
}

function cloneSavedRequest(request: ApiClientSavedRequest): ApiClientSavedRequest {
  assertPortableDraft(request);
  const draft = cloneRequestDraft(request.request);
  if (draft.binary) delete draft.binary.file;
  if (draft.formData) draft.formData = draft.formData.map((entry) => {
    const next = { ...entry };
    delete next.file;
    return next;
  });
  return {
    ...request,
    request: draft,
    scripts: request.scripts ? cloneApiClientScripts(request.scripts) : undefined,
  };
}

function cloneEnvironment(environment: ApiClientEnvironment): ApiClientEnvironment {
  return { ...environment, variables: environment.variables.map((variable) => ({ ...variable })) };
}

function collectionForScope(workspace: ApiClientWorkspaceState, scope: ApiClientRunnerArtifactScope): ApiClientCollection {
  const collection = workspace.collections.find((candidate) => candidate.id === scope.collectionId);
  if (!collection) throw new Error(`Runner scope references missing collection ${scope.collectionId}.`);
  return collection;
}

function ancestorFolderIds(workspace: ApiClientWorkspaceState, collectionId: string, folderId?: string): Set<string> {
  const ids = new Set<string>();
  const byId = new Map(workspace.folders
    .filter((folder) => folder.collectionId === collectionId)
    .map((folder) => [folder.id, folder]));
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !ids.has(current.id)) {
    ids.add(current.id);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }
  return ids;
}

function descendantFolderIds(workspace: ApiClientWorkspaceState, collectionId: string, folderId: string): Set<string> {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of workspace.folders) {
      if (folder.collectionId !== collectionId || !folder.parentFolderId || ids.has(folder.id)) continue;
      if (ids.has(folder.parentFolderId)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function artifactFolders(workspace: ApiClientWorkspaceState, scope: ApiClientRunnerArtifactScope): ApiClientFolder[] {
  if (scope.type === 'collection') {
    return workspace.folders.filter((folder) => folder.collectionId === scope.collectionId).map(cloneFolder);
  }

  if (scope.type === 'folder') {
    const folder = workspace.folders.find((candidate) => candidate.id === scope.folderId && candidate.collectionId === scope.collectionId);
    if (!folder) throw new Error(`Runner scope references missing folder ${scope.folderId}.`);
    const ids = descendantFolderIds(workspace, scope.collectionId, scope.folderId);
    for (const ancestorId of ancestorFolderIds(workspace, scope.collectionId, scope.folderId)) ids.add(ancestorId);
    return workspace.folders.filter((candidate) => candidate.collectionId === scope.collectionId && ids.has(candidate.id)).map(cloneFolder);
  }

  const request = workspace.requests.find((candidate) => candidate.id === scope.requestId && candidate.collectionId === scope.collectionId);
  if (!request) throw new Error(`Runner scope references missing request ${scope.requestId}.`);
  const ids = ancestorFolderIds(workspace, scope.collectionId, request.folderId);
  return workspace.folders.filter((candidate) => candidate.collectionId === scope.collectionId && ids.has(candidate.id)).map(cloneFolder);
}

function artifactRequests(workspace: ApiClientWorkspaceState, scope: ApiClientRunnerArtifactScope): ApiClientSavedRequest[] {
  if (scope.type === 'collection') {
    return workspace.requests.filter((request) => request.collectionId === scope.collectionId).map(cloneSavedRequest);
  }
  if (scope.type === 'folder') {
    const folderIds = descendantFolderIds(workspace, scope.collectionId, scope.folderId);
    return workspace.requests
      .filter((request) => request.collectionId === scope.collectionId && !!request.folderId && folderIds.has(request.folderId))
      .map(cloneSavedRequest);
  }
  const request = workspace.requests.find((candidate) => candidate.id === scope.requestId && candidate.collectionId === scope.collectionId);
  if (!request) throw new Error(`Runner scope references missing request ${scope.requestId}.`);
  return [cloneSavedRequest(request)];
}

function requireExecutableRequests(requests: ApiClientSavedRequest[], scope: ApiClientRunnerArtifactScope): void {
  if (requests.length === 0) throw new Error(`Runner ${scope.type} scope contains no executable saved requests.`);
}

function artifactEnvironment(
  workspace: ApiClientWorkspaceState,
  environmentId: string | false | undefined,
): { environments: ApiClientEnvironment[]; activeEnvironmentId?: string } {
  const selectedId = environmentId === false ? undefined : environmentId ?? workspace.activeEnvironmentId;
  if (!selectedId) return { environments: [] };
  const environment = workspace.environments.find((candidate) => candidate.id === selectedId);
  if (!environment) {
    if (typeof environmentId === 'string') throw new Error(`Runner export references missing environment ${environmentId}.`);
    return { environments: [] };
  }
  return { environments: [cloneEnvironment(environment)], activeEnvironmentId: environment.id };
}

/**
 * Export one request, folder subtree, or collection from the canonical API Client workspace.
 * History is never exported, and only the selected environment is embedded.
 */
export function exportApiClientRunnerArtifact(
  workspace: ApiClientWorkspaceState,
  scope: ApiClientRunnerArtifactScope,
  options: ExportApiClientRunnerArtifactOptions = {},
): ApiClientRunnerArtifact {
  const collection = collectionForScope(workspace, scope);
  const requests = artifactRequests(workspace, scope);
  requireExecutableRequests(requests, scope);
  const environment = artifactEnvironment(workspace, options.environmentId);
  const artifactWorkspace: ApiClientWorkspaceState = {
    version: 6,
    collections: [cloneCollection(collection)],
    folders: artifactFolders(workspace, scope),
    requests,
    environments: environment.environments,
    ...(environment.activeEnvironmentId ? { activeEnvironmentId: environment.activeEnvironmentId } : {}),
    history: [],
  };

  return {
    kind: API_CLIENT_RUNNER_ARTIFACT_KIND,
    version: API_CLIENT_RUNNER_ARTIFACT_VERSION,
    exportedAt: options.exportedAt || new Date().toISOString(),
    scope: { ...scope },
    workspace: artifactWorkspace,
  };
}

function parseScope(value: unknown): ApiClientRunnerArtifactScope {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.collectionId !== 'string' || !value.collectionId) {
    throw new Error('Invalid FlexDoc Runner artifact scope.');
  }
  if (value.type === 'collection') return { type: 'collection', collectionId: value.collectionId };
  if (value.type === 'folder' && typeof value.folderId === 'string' && value.folderId) {
    return { type: 'folder', collectionId: value.collectionId, folderId: value.folderId };
  }
  if (value.type === 'request' && typeof value.requestId === 'string' && value.requestId) {
    return { type: 'request', collectionId: value.collectionId, requestId: value.requestId };
  }
  throw new Error('Invalid FlexDoc Runner artifact scope.');
}

function assertUniqueEntityIds<T extends { id: string }>(entities: T[], label: string): void {
  const ids = entities.map((entity) => entity.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Runner artifact workspace contains duplicate ${label} ids.`);
}

function sameEntityOrder<T extends { id: string }>(actual: T[], expected: T[]): boolean {
  return actual.length === expected.length && actual.every((entity, index) => entity.id === expected[index]?.id);
}

function validateScope(workspace: ApiClientWorkspaceState, scope: ApiClientRunnerArtifactScope): void {
  const collection = collectionForScope(workspace, scope);
  if (workspace.collections.length !== 1 || workspace.collections[0].id !== collection.id) {
    throw new Error('Runner artifact workspace must contain exactly the scoped collection.');
  }
  if (workspace.environments.length > 1) {
    throw new Error('Runner artifact workspace may contain at most one selected environment.');
  }
  if (workspace.environments.length === 0 && workspace.activeEnvironmentId !== undefined) {
    throw new Error('Runner artifact workspace cannot select an environment that is not embedded.');
  }
  if (workspace.environments.length === 1 && workspace.activeEnvironmentId !== workspace.environments[0].id) {
    throw new Error('Runner artifact workspace must activate its single embedded environment.');
  }

  if (scope.type === 'folder'
    && !workspace.folders.some((folder) => folder.id === scope.folderId && folder.collectionId === scope.collectionId)) {
    throw new Error(`Runner artifact references missing folder ${scope.folderId}.`);
  }
  if (scope.type === 'request'
    && !workspace.requests.some((request) => request.id === scope.requestId && request.collectionId === scope.collectionId)) {
    throw new Error(`Runner artifact references missing request ${scope.requestId}.`);
  }

  const expectedFolders = artifactFolders(workspace, scope);
  const expectedRequests = artifactRequests(workspace, scope);
  requireExecutableRequests(expectedRequests, scope);
  if (!sameEntityOrder(workspace.folders, expectedFolders) || !sameEntityOrder(workspace.requests, expectedRequests)) {
    throw new Error(`Runner artifact workspace contains entities outside its declared ${scope.type} scope.`);
  }
}

function canonicalWorkspaceFromArtifact(value: UnknownRecord): UnknownRecord {
  if (value.version !== 6
    || !Array.isArray(value.collections)
    || !Array.isArray(value.folders)
    || !Array.isArray(value.requests)
    || !Array.isArray(value.environments)
    || !Array.isArray(value.history)
    || value.history.length !== 0
    || (value.activeEnvironmentId !== undefined && typeof value.activeEnvironmentId !== 'string')) {
    throw new Error('Invalid FlexDoc Runner artifact workspace. Expected canonical workspace version 6 with empty history.');
  }
  return {
    version: 6,
    collections: value.collections,
    folders: value.folders,
    requests: value.requests,
    environments: value.environments,
    ...(value.activeEnvironmentId !== undefined ? { activeEnvironmentId: value.activeEnvironmentId } : {}),
    history: [],
  };
}

/** Parse and normalize a portable FlexDoc Runner artifact from untrusted JSON input. */
export function parseApiClientRunnerArtifact(value: unknown): ApiClientRunnerArtifact {
  if (!isRecord(value)
    || value.kind !== API_CLIENT_RUNNER_ARTIFACT_KIND
    || value.version !== API_CLIENT_RUNNER_ARTIFACT_VERSION
    || typeof value.exportedAt !== 'string'
    || !value.exportedAt.trim()
    || !isRecord(value.workspace)) {
    throw new Error('Invalid FlexDoc Runner artifact. Expected flexdoc-runner version 1.');
  }

  const scope = parseScope(value.scope);
  const rawWorkspace = canonicalWorkspaceFromArtifact(value.workspace);
  const workspace = normalizeApiClientWorkspace(rawWorkspace);
  if (stableJson(rawWorkspace) !== stableJson(workspace)) {
    throw new Error('Invalid FlexDoc Runner artifact workspace. Portable artifacts must not require workspace migration or normalization repairs.');
  }
  assertUniqueEntityIds(workspace.collections, 'collection');
  assertUniqueEntityIds(workspace.folders, 'folder');
  assertUniqueEntityIds(workspace.requests, 'request');
  assertUniqueEntityIds(workspace.environments, 'environment');
  validateScope(workspace, scope);
  for (const request of workspace.requests) assertPortableDraft(request);

  return {
    kind: API_CLIENT_RUNNER_ARTIFACT_KIND,
    version: API_CLIENT_RUNNER_ARTIFACT_VERSION,
    exportedAt: value.exportedAt,
    scope,
    workspace,
  };
}

/** Serialize a Runner artifact as stable, human-reviewable JSON. */
export function serializeApiClientRunnerArtifact(artifact: ApiClientRunnerArtifact): string {
  return `${JSON.stringify(parseApiClientRunnerArtifact(artifact), null, 2)}\n`;
}
