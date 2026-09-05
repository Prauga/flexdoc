import {
  createFlexDocViewerPreferencesKey,
  readFlexDocViewerPreferences,
  resolveExpandSections,
  writeFlexDocViewerExpandPreference,
} from './renderer-preferences';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

describe('renderer expansion preferences', () => {
  test('uses a compact product default and resolves named presets', () => {
    expect(resolveExpandSections()).toEqual([]);
    expect(resolveExpandSections('minimal')).toEqual([]);
    expect(resolveExpandSections('documentation')).toEqual(['parameters', 'requestBody', 'responses']);
    expect(resolveExpandSections('interactive')).toEqual(['parameters', 'requestBody', 'tryIt', 'codeSamples']);
    expect(resolveExpandSections('all')).toEqual(['parameters', 'requestBody', 'responses', 'tryIt', 'codeSamples']);
  });

  test('unions presets and explicit sections in lists', () => {
    expect(resolveExpandSections(['documentation', 'tryIt'])).toEqual(['parameters', 'requestBody', 'responses', 'tryIt']);
    expect(resolveExpandSections(['requestBody', 'codeSamples'])).toEqual(['requestBody', 'codeSamples']);
  });

  test('preserves explicit legacy expandResponses behavior when expand is absent', () => {
    expect(resolveExpandSections(undefined, 'none')).toEqual(['parameters', 'requestBody', 'tryIt', 'codeSamples']);
    expect(resolveExpandSections(undefined, '200,201')).toEqual(['parameters', 'requestBody', 'responses', 'tryIt', 'codeSamples']);
    expect(resolveExpandSections('minimal', '200,201')).toEqual([]);
  });

  test('persists a per-document viewer override and resets to host defaults by removing it', () => {
    const storage = memoryStorage();
    const key = createFlexDocViewerPreferencesKey('Pets API', 'docs.example.test');
    expect(key).not.toBe(createFlexDocViewerPreferencesKey('Billing API', 'docs.example.test'));
    writeFlexDocViewerExpandPreference(key, ['responses'], storage);
    expect(readFlexDocViewerPreferences(key, storage).expand).toEqual(['responses']);
    writeFlexDocViewerExpandPreference(key, undefined, storage);
    expect(readFlexDocViewerPreferences(key, storage).expand).toBeUndefined();
  });

  test('ignores malformed or unsupported stored preferences', () => {
    const storage = memoryStorage();
    storage.setItem('prefs', JSON.stringify({ version: 1, expand: ['madeUpSection'] }));
    expect(readFlexDocViewerPreferences('prefs', storage)).toEqual({ version: 1 });
    storage.setItem('prefs', '{broken');
    expect(readFlexDocViewerPreferences('prefs', storage)).toEqual({ version: 1 });
  });
});
