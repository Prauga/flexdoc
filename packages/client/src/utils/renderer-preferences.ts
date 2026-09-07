import type { ExpandOption, ExpandPreset, ExpandSection, FlexDocViewerTheme } from '../types/options';

export const EXPAND_SECTIONS: ExpandSection[] = ['parameters', 'requestBody', 'responses', 'tryIt', 'codeSamples'];

const EXPAND_PRESETS: Record<ExpandPreset, ExpandSection[]> = {
  all: EXPAND_SECTIONS,
  none: [],
  minimal: [],
  documentation: ['parameters', 'requestBody', 'responses'],
  interactive: ['parameters', 'requestBody', 'tryIt', 'codeSamples'],
};

const ARRAY_PRESETS = new Set(['minimal', 'documentation', 'interactive']);
const SECTION_SET = new Set(EXPAND_SECTIONS);
const PRESET_SET = new Set(Object.keys(EXPAND_PRESETS));
const VIEWER_THEMES = new Set<FlexDocViewerTheme>(['light', 'dark', 'high-contrast']);

export interface FlexDocViewerPreferences {
  version: 1;
  expand?: ExpandOption;
  sidebarCollapsed?: boolean;
  theme?: FlexDocViewerTheme;
  expandedTags?: string[];
}

export function isExpandOption(value: unknown): value is ExpandOption {
  if (typeof value === 'string') return PRESET_SET.has(value);
  return Array.isArray(value) && value.every((entry) =>
    typeof entry === 'string' && (SECTION_SET.has(entry as ExpandSection) || ARRAY_PRESETS.has(entry))
  );
}

function addPreset(target: Set<ExpandSection>, preset: ExpandPreset): void {
  for (const section of EXPAND_PRESETS[preset]) target.add(section);
}

export function resolveExpandSections(expand?: ExpandOption, legacyExpandResponses?: string): ExpandSection[] {
  if (expand === undefined && legacyExpandResponses !== undefined) {
    const legacy = new Set<ExpandSection>(['parameters', 'requestBody', 'tryIt', 'codeSamples']);
    if (legacyExpandResponses !== 'none') legacy.add('responses');
    return EXPAND_SECTIONS.filter((section) => legacy.has(section));
  }

  if (expand === undefined) return [];
  if (typeof expand === 'string') return [...EXPAND_PRESETS[expand]];

  const resolved = new Set<ExpandSection>();
  for (const entry of expand) {
    if (SECTION_SET.has(entry as ExpandSection)) resolved.add(entry as ExpandSection);
    else addPreset(resolved, entry as ExpandPreset);
  }
  return EXPAND_SECTIONS.filter((section) => resolved.has(section));
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
    if (parsed.theme !== undefined && (typeof parsed.theme !== 'string' || !VIEWER_THEMES.has(parsed.theme as FlexDocViewerTheme))) return { version: 1 };
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

function writePreferences(key: string, next: FlexDocViewerPreferences, storage?: Storage): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    if (next.expand === undefined && next.sidebarCollapsed === undefined && next.theme === undefined && next.expandedTags === undefined) resolvedStorage.removeItem(key);
    else resolvedStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Viewer preferences are best-effort and must never prevent documentation rendering.
  }
}

export function writeFlexDocViewerExpandPreference(key: string, expand?: ExpandOption, storage?: Storage): void {
  const current = readFlexDocViewerPreferences(key, storage);
  const next: FlexDocViewerPreferences = { ...current };
  if (expand === undefined) delete next.expand;
  else next.expand = expand;
  writePreferences(key, next, storage);
}

export function writeFlexDocViewerSidebarPreference(key: string, sidebarCollapsed?: boolean, storage?: Storage): void {
  const current = readFlexDocViewerPreferences(key, storage);
  const next: FlexDocViewerPreferences = { ...current };
  if (sidebarCollapsed === undefined) delete next.sidebarCollapsed;
  else next.sidebarCollapsed = sidebarCollapsed;
  writePreferences(key, next, storage);
}

export function writeFlexDocViewerThemePreference(key: string, theme?: FlexDocViewerTheme, storage?: Storage): void {
  const current = readFlexDocViewerPreferences(key, storage);
  const next: FlexDocViewerPreferences = { ...current };
  if (theme === undefined) delete next.theme;
  else next.theme = theme;
  writePreferences(key, next, storage);
}

export function writeFlexDocViewerExpandedTagsPreference(key: string, expandedTags?: string[], storage?: Storage): void {
  const current = readFlexDocViewerPreferences(key, storage);
  const next: FlexDocViewerPreferences = { ...current };
  if (expandedTags === undefined) delete next.expandedTags;
  else next.expandedTags = [...new Set(expandedTags)];
  writePreferences(key, next, storage);
}
