import type { ExpandOption, ExpandPreset, ExpandSection, FlexDocViewerTheme } from '../types/options';

export const EXPAND_SECTIONS: ExpandSection[] = ['parameters', 'requestBody', 'responses', 'tryIt', 'codeSamples'];

const EXPAND_PRESETS: Record<ExpandPreset, ExpandSection[]> = {
  all: EXPAND_SECTIONS,
  none: [],
  minimal: [],
  documentation: ['parameters', 'requestBody', 'responses'],
  interactive: ['parameters', 'requestBody', 'tryIt', 'codeSamples'],
};

const ARRAY_PRESETS = ['minimal', 'documentation', 'interactive'];
const PRESET_NAMES = Object.keys(EXPAND_PRESETS);
const VIEWER_THEMES: FlexDocViewerTheme[] = ['light', 'dark', 'high-contrast'];

export interface FlexDocViewerPreferences {
  version: 1;
  expand?: ExpandOption;
  sidebarCollapsed?: boolean;
  theme?: FlexDocViewerTheme;
  expandedTags?: string[];
}

export function isExpandOption(value: unknown): value is ExpandOption {
  if (typeof value === 'string') return PRESET_NAMES.includes(value);
  return Array.isArray(value) && value.every((entry) =>
    typeof entry === 'string' && (EXPAND_SECTIONS.includes(entry as ExpandSection) || ARRAY_PRESETS.includes(entry))
  );
}

export function resolveExpandSections(expand?: ExpandOption, legacyExpandResponses?: string): ExpandSection[] {
  if (expand === undefined && legacyExpandResponses !== undefined) {
    return EXPAND_SECTIONS.filter((section) => legacyExpandResponses !== 'none' || section !== 'responses');
  }
  if (expand === undefined) return [];
  if (typeof expand === 'string') return [...EXPAND_PRESETS[expand]];
  return EXPAND_SECTIONS.filter((section) => expand.some((entry) =>
    entry === section || EXPAND_PRESETS[entry as ExpandPreset]?.includes(section)
  ));
}

export function createFlexDocViewerPreferencesKey(title?: string, host?: string): string {
  return `flexdoc:viewer:${encodeURIComponent(host?.trim() || 'unknown-host')}:${encodeURIComponent(title?.trim() || 'untitled')}`;
}

export function readFlexDocViewerPreferences(key: string, storage?: Storage): FlexDocViewerPreferences {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return { version: 1 };
  try {
    const raw = resolvedStorage.getItem(key);
    if (!raw) return { version: 1 };
    const parsed = JSON.parse(raw) as { version?: unknown; expand?: unknown; sidebarCollapsed?: unknown; theme?: unknown; expandedTags?: unknown };
    if (parsed.version !== 1) return { version: 1 };
    if (parsed.expand !== undefined && !isExpandOption(parsed.expand)) return { version: 1 };
    if (parsed.sidebarCollapsed !== undefined && typeof parsed.sidebarCollapsed !== 'boolean') return { version: 1 };
    if (parsed.theme !== undefined && (typeof parsed.theme !== 'string' || !VIEWER_THEMES.includes(parsed.theme as FlexDocViewerTheme))) return { version: 1 };
    if (parsed.expandedTags !== undefined && (!Array.isArray(parsed.expandedTags) || !parsed.expandedTags.every((tag) => typeof tag === 'string'))) return { version: 1 };
    return {
      version: 1,
      ...(parsed.expand !== undefined ? { expand: parsed.expand } : {}),
      ...(parsed.sidebarCollapsed !== undefined ? { sidebarCollapsed: parsed.sidebarCollapsed } : {}),
      ...(parsed.theme !== undefined ? { theme: parsed.theme as FlexDocViewerTheme } : {}),
      ...(parsed.expandedTags !== undefined ? { expandedTags: [...new Set(parsed.expandedTags as string[])] } : {}),
    };
  } catch {
    return { version: 1 };
  }
}

export function writeFlexDocViewerPreference<K extends Exclude<keyof FlexDocViewerPreferences, 'version'>>(
  key: string,
  field: K,
  value: FlexDocViewerPreferences[K],
  storage?: Storage,
): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    const next = { ...readFlexDocViewerPreferences(key, resolvedStorage) };
    const stored = field === 'expandedTags' && Array.isArray(value) ? [...new Set(value)] : value;
    if (stored === undefined) delete next[field];
    else next[field] = stored as FlexDocViewerPreferences[K];
    if (next.expand === undefined && next.sidebarCollapsed === undefined && next.theme === undefined && next.expandedTags === undefined) resolvedStorage.removeItem(key);
    else resolvedStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Viewer preferences are best-effort and must never prevent documentation rendering.
  }
}
