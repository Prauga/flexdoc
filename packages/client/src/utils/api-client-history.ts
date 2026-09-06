
import type { ApiClientHistoryEntry, ApiClientWorkspaceState } from './api-client-workspace';

export type ApiClientHistoryOutcomeFilter = 'all' | 'success' | 'failed' | 'tests';

export interface ApiClientHistoryFilters {
  query: string;
  method: string;
  outcome: ApiClientHistoryOutcomeFilter;
}

export interface ApiClientHistoryRunGroup {
  runId: string;
  runName: string;
  entries: ApiClientHistoryEntry[];
  total: number;
  captured: number;
  passed: number;
  failed: number;
  cancelled: number;
}

export type ApiClientHistoryDisplayBlock =
  | { kind: 'entry'; entry: ApiClientHistoryEntry }
  | { kind: 'run'; group: ApiClientHistoryRunGroup };

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
    const matchesSearch = !needle || [entry.executedMethod, entry.resolvedUrl, entry.status, entry.statusText, collection, folder, entry.runName]
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

export function groupApiClientHistoryEntries(entries: ApiClientHistoryEntry[]): ApiClientHistoryDisplayBlock[] {
  const seenRuns = new Set<string>();
  const blocks: ApiClientHistoryDisplayBlock[] = [];
  for (const entry of entries) {
    if (!entry.runId) {
      blocks.push({ kind: 'entry', entry });
      continue;
    }
    if (seenRuns.has(entry.runId)) continue;
    seenRuns.add(entry.runId);
    const grouped = entries
      .filter((candidate) => candidate.runId === entry.runId)
      .sort((left, right) => (left.runIndex || Number.MAX_SAFE_INTEGER) - (right.runIndex || Number.MAX_SAFE_INTEGER));
    const total = Math.max(grouped.length, ...grouped.map((candidate) => candidate.runTotal || 0));
    blocks.push({
      kind: 'run',
      group: {
        runId: entry.runId,
        runName: entry.runName || 'Collection run',
        entries: grouped,
        total,
        captured: grouped.length,
        passed: grouped.filter((candidate) => candidate.runPassed === true).length,
        failed: grouped.filter((candidate) => candidate.runPassed === false).length,
        // Cancelled runner items intentionally do not persist history rows.
        cancelled: 0,
      },
    });
  }
  return blocks;
}
