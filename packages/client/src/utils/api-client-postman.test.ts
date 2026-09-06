import {
  importPostmanCollection,
  importPostmanDocument,
  importPostmanEnvironment,
  mergePostmanCollectionImport,
  mergePostmanEnvironmentImport,
} from './api-client-postman';
import { createDefaultApiClientWorkspace } from './api-client-workspace';

describe('Postman import', () => {
  it('imports a v2.1 collection into the canonical workspace model', () => {
    const imported = importPostmanCollection({
      info: {
        name: 'Pet API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
      variable: [{ key: 'baseUrl', value: 'https://api.example.test' }],
      event: [{
        listen: 'prerequest',
        script: { exec: ["pm.collectionVariables.set('collectionHook', 'yes');"] },
      }],
      item: [{
        name: 'Pets',
        auth: {
          type: 'basic',
          basic: [
            { key: 'username', value: '{{username}}' },
            { key: 'password', value: '{{password}}' },
          ],
        },
        event: [{
          listen: 'prerequest',
          script: { exec: ["pm.environment.set('folderHook', 'yes');"] },
        }],
        item: [{
          name: 'Get pet',
          request: {
            method: 'GET',
            auth: { type: 'noauth' },
            header: [{ key: 'Accept', value: 'application/json' }],
            url: {
              raw: '{{baseUrl}}/pets/:id?expand=owner',
              query: [{ key: 'expand', value: 'owner' }],
              variable: [{ key: 'id', value: '42' }],
            },
          },
          event: [{
            listen: 'test',
            script: { exec: ["pm.test('status', () => pm.expect(pm.response.code).to.eql(200));"] },
          }],
        }],
      }],
    });

    expect(imported.collection.name).toBe('Pet API');
    expect(imported.collection.auth).toEqual({ type: 'bearer', token: '{{token}}' });
    expect(imported.collection.variables).toEqual([
      expect.objectContaining({ key: 'baseUrl', value: 'https://api.example.test', enabled: true }),
    ]);
    expect(imported.folders).toHaveLength(1);
    expect(imported.folders[0]).toEqual(expect.objectContaining({
      name: 'Pets',
      auth: { type: 'basic', username: '{{username}}', password: '{{password}}' },
    }));
    expect(imported.requests).toHaveLength(1);
    expect(imported.requests[0].request).toEqual(expect.objectContaining({
      method: 'GET',
      url: '{{baseUrl}}/pets/{{id}}',
      query: [{ key: 'expand', value: 'owner', enabled: true }],
      auth: { type: 'none' },
    }));
    expect(imported.requests[0].scripts?.preRequest).toContain("flex.collection.set('collectionHook', 'yes')");
    expect(imported.requests[0].scripts?.preRequest).toContain("flex.environment.set('folderHook', 'yes')");
    expect(imported.requests[0].scripts?.tests).toContain("flex.test('status', () => flex.expect(flex.response.code).to.eql(200))");
    expect(imported.warnings).toEqual([]);
  });

  it('maps Postman inherit auth without compatibility warnings', () => {
    const imported = importPostmanCollection({
      info: { name: 'Inherited auth' },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
      item: [{
        name: 'Inherited folder',
        auth: { type: 'inherit' },
        item: [{
          name: 'Inherited request',
          request: { method: 'GET', url: 'https://example.test', auth: { type: 'inherit' } },
        }],
      }],
    });

    expect(imported.folders[0].auth).toEqual({ type: 'inherit' });
    expect(imported.requests[0].request.auth).toEqual({ type: 'inherit' });
    expect(imported.warnings).toEqual([]);
  });

  it('preserves raw, urlencoded, GraphQL, and multipart bodies as structured request modes', () => {
    const imported = importPostmanCollection({
      info: { name: 'Bodies' },
      item: [
        { name: 'Raw', request: { method: 'POST', url: 'https://example.test/raw', body: { mode: 'raw', raw: '{"ok":true}', options: { raw: { language: 'json' } } } } },
        { name: 'Form', request: { method: 'POST', url: 'https://example.test/form', body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '{{value}}' }] } } },
        { name: 'GraphQL', request: { method: 'POST', url: 'https://example.test/graphql', body: { mode: 'graphql', graphql: { query: 'query { ok }', variables: '{"id":1}' } } } },
        { name: 'Multipart', request: { method: 'POST', url: 'https://example.test/upload', body: { mode: 'formdata', formdata: [{ key: 'name', value: 'pet' }, { key: 'photo', type: 'file', src: '/tmp/pet.png' }] } } },
      ],
    });

    expect(imported.requests[0].request).toEqual(expect.objectContaining({
      body: '{"ok":true}',
      bodyMode: 'json',
      contentType: 'application/json',
    }));
    expect(imported.requests[1].request).toEqual(expect.objectContaining({
      body: '',
      bodyMode: 'urlencoded',
      contentType: 'application/x-www-form-urlencoded',
      urlencoded: [{ key: 'a', value: '{{value}}', enabled: true }],
    }));
    expect(imported.requests[2].request).toEqual(expect.objectContaining({
      body: '',
      bodyMode: 'graphql',
      contentType: 'application/json',
      graphql: { query: 'query { ok }', variables: '{"id":1}' },
    }));
    expect(imported.requests[3].request).toEqual(expect.objectContaining({
      body: '',
      bodyMode: 'formdata',
      formData: [
        { key: 'name', value: 'pet', enabled: true, type: 'text' },
        { key: 'photo', value: '', enabled: true, type: 'file', fileName: '/tmp/pet.png' },
      ],
    }));
    expect(imported.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'postman-body-formdata-files' }),
    ]));
  });

  it('preserves Postman binary file bodies as re-selectable binary intent', () => {
    const imported = importPostmanCollection({
      info: { name: 'Binary' },
      item: [{
        name: 'Upload archive',
        request: {
          method: 'POST',
          url: 'https://example.test/upload',
          header: [{ key: 'Content-Type', value: 'application/zip' }],
          body: { mode: 'file', file: { src: '/tmp/archive.zip' } },
        },
      }],
    });

    expect(imported.requests[0].request).toEqual(expect.objectContaining({
      bodyMode: 'binary',
      contentType: 'application/zip',
      binary: { fileName: '/tmp/archive.zip', contentType: 'application/zip' },
    }));
    expect(imported.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'postman-body-file' }),
    ]));
  });

  it('keeps partially compatible Postman scripts but emits an explicit warning', () => {
    const imported = importPostmanCollection({
      info: { name: 'Scripts' },
      item: [{
        name: 'Chain',
        request: 'https://example.test',
        event: [{ listen: 'test', script: { exec: ["pm.sendRequest('https://example.test/next', () => {});"] } }],
      }],
    });

    expect(imported.requests[0].scripts?.tests).toContain('pm.sendRequest');
    expect(imported.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'postman-script-partial-compatibility' }),
    ]));
  });

  it('imports Postman environments and activates the first imported environment', () => {
    const imported = importPostmanEnvironment({
      name: 'Local',
      _postman_variable_scope: 'environment',
      values: [
        { key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
        { key: 'disabled', value: 'no', enabled: false },
      ],
    });
    const workspace = mergePostmanEnvironmentImport(createDefaultApiClientWorkspace(), imported);

    expect(imported.environment.name).toBe('Local');
    expect(imported.environment.variables[1].enabled).toBe(false);
    expect(workspace.activeEnvironmentId).toBe(imported.environment.id);
    expect(importPostmanDocument({ name: 'Local', values: [] }).kind).toBe('environment');
  });

  it('replaces the untouched default collection when importing into a fresh workspace', () => {
    const imported = importPostmanCollection({ info: { name: 'Imported' }, item: [] });
    const workspace = mergePostmanCollectionImport(createDefaultApiClientWorkspace(), imported);

    expect(workspace.collections).toHaveLength(1);
    expect(workspace.collections[0].name).toBe('Imported');
  });
});
