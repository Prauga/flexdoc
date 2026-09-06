import type { ApiClientHistoryEntry, ApiClientWorkspaceState } from './api-client-workspace';

export type ApiClientHistoryOutcomeFilter = 'all' | 'success' | 'failed' | 'tests';

export interface ApiClientHistoryFilters {
  query: string;
  method: string;
  outcome: ApiClientHistoryOutcomeFilter;
}

function hasFailure(entry: ApiClientHistoryEntry): boolean {
  return !!entry.error
    || !!entry.scriptError
    || (entry.status !== undefined && entry.status >= 400)
    || !!entry.scriptTests?.some((test) => !test.passed);
}

export function filterApiClientHistoryEntries(
  workspace: ApiClientWorkspaceState,
  filters: ApiClientHistoryFilters,
): ApiClientHistoryEntry[] {
  const needle = filters.query.trim().toLowerCase();
  return workspace.history.filter((entry) => {
    const collection = entry.collectionId
      ? workspace.collections.find((candidate) => candidate.id === entry.collectionId)?.name || 'Deleted collection'
      : '';
    const folder = entry.folderId
      ? workspace.folders.find((candidate) => candidate.id === entry.folderId)?.name || 'Deleted folder'
      : '';
    const matchesSearch = !needle || [entry.executedMethod, entry.resolvedUrl, entry.status, entry.statusText, collection, folder]
      .filter((value) => value !== undefined)
      .some((value) => String(value).toLowerCase().includes(needle));
    const matchesMethod = filters.method === 'all' || entry.executedMethod.toUpperCase() === filters.method;
    const failed = hasFailure(entry);
    const matchesOutcome = filters.outcome === 'all'
      || (filters.outcome === 'success' && !failed)
      || (filters.outcome === 'failed' && failed)
      || (filters.outcome === 'tests' && !!entry.scriptTests?.length);
    return matchesSearch && matchesMethod && matchesOutcome;
  });
}
