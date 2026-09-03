import {
  apiClientCollectionVariables,
  createDefaultApiClientWorkspace,
  normalizeApiClientWorkspace,
} from './api-client-workspace';

describe('api-client collection variables', () => {
  it('adds an empty collection variable set when normalizing legacy workspaces', () => {
    const workspace = normalizeApiClientWorkspace({
      version: 4,
      collections: [{
        id: 'collection-1',
        name: 'Legacy collection',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }],
      folders: [],
      requests: [],
      environments: [],
      history: [],
    });

    expect(workspace.collections[0].variables).toEqual([]);
  });

  it('filters malformed persisted collection variables without dropping the collection', () => {
    const workspace = normalizeApiClientWorkspace({
      version: 4,
      collections: [{
        id: 'collection-1',
        name: 'Pets',
        variables: [
          null,
          { id: 'variable-1', key: 'baseUrl', value: 'https://api.example.test' },
          { id: 'variable-bad', key: 'token', value: 42 },
        ],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }],
      folders: [],
      requests: [],
      environments: [],
      history: [],
    });

    expect(workspace.collections).toHaveLength(1);
    expect(workspace.collections[0].variables).toEqual([
      { id: 'variable-1', key: 'baseUrl', value: 'https://api.example.test' },
    ]);
  });

  it('builds a prototype-safe collection variable map from enabled named values', () => {
    const workspace = createDefaultApiClientWorkspace();
    const collection = workspace.collections[0];
    collection.variables.push(
      { id: 'variable-1', key: 'baseUrl', value: 'https://one.example.test' },
      { id: 'variable-2', key: 'token', value: 'disabled', enabled: false },
      { id: 'variable-3', key: 'baseUrl', value: 'https://two.example.test' },
      { id: 'variable-4', key: '   ', value: 'ignored' },
      { id: 'variable-5', key: '__proto__', value: 'safe-proto' },
      { id: 'variable-6', key: 'constructor', value: 'safe-constructor' },
    );

    const variables = apiClientCollectionVariables(workspace, collection.id);

    expect(Object.getPrototypeOf(variables)).toBeNull();
    expect(variables.baseUrl).toBe('https://two.example.test');
    expect(variables.__proto__).toBe('safe-proto');
    expect(variables.constructor).toBe('safe-constructor');
    expect(Object.prototype.hasOwnProperty.call(variables, 'token')).toBe(false);
  });

  it('returns an empty prototype-safe map when no collection is selected', () => {
    const variables = apiClientCollectionVariables(createDefaultApiClientWorkspace(), 'missing');
    expect(Object.getPrototypeOf(variables)).toBeNull();
    expect(Object.keys(variables)).toEqual([]);
  });
});
