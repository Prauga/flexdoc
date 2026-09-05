import type { ExpandOption, ExpandPreset, ExpandSection } from '../types/options';

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

export interface FlexDocViewerPreferences {
  version: 1;
  expand?: ExpandOption;
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
    const parsed = JSON.parse(raw) as { version?: unknown; expand?: unknown };
    if (parsed.version !== 1 || (parsed.expand !== undefined && !isExpandOption(parsed.expand))) return { version: 1 };
    return { version: 1, ...(parsed.expand !== undefined ? { expand: parsed.expand } : {}) };
  } catch {
    return { version: 1 };
  }
}

export function writeFlexDocViewerExpandPreference(key: string, expand?: ExpandOption, storage?: Storage): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    if (expand === undefined) resolvedStorage.removeItem(key);
    else resolvedStorage.setItem(key, JSON.stringify({ version: 1, expand } satisfies FlexDocViewerPreferences));
  } catch {
    // Viewer preferences are best-effort and must never prevent documentation rendering.
  }
}
