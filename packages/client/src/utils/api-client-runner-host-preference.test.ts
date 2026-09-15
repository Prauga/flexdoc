import { runApiClientCollection } from './api-client-runner';
import type { ApiClientWorkspaceState } from './api-client-workspace';

function workspace(): ApiClientWorkspaceState {
  const timestamp = '2026-09-15T00:00:00.000Z';
  return {
    version: 6,
    collections: [{ id: 'collection', name: 'Runner', createdAt: timestamp, updatedAt: timestamp }],
    folders: [],
    requests: [{
      id: 'request',
      collectionId: 'collection',
      name: 'Health',
      request: { method: 'GET', url: 'https://api.example.test/health' },
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    environments: [],
    history: [],
  };
}

function directResponse(): Response {
  return {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => 'direct',
  } as Response;
}

function hostResponse(): Response {
  return {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => JSON.stringify({
      status: 204,
      statusText: 'No Content',
      headers: [],
      body: '',
      responseTime: 1,
    }),
  } as Response;
}

describe('collection runner host preference', () => {
  it('keeps ordinary collection runs on direct transport by default', async () => {
    const calls: string[] = [];
    await runApiClientCollection({
      workspace: workspace(),
      collectionId: 'collection',
      hostExecution: {
        available: true,
        endpoint: '/docs/__flexdoc/execute',
        capabilities: [],
        preferHostExecution: true,
      },
      fetcher: async (input) => {
        calls.push(String(input));
        return directResponse();
      },
    });

    expect(calls).toEqual(['https://api.example.test/health']);
  });

  it('uses native host transport only when the collection run explicitly opts in', async () => {
    const calls: string[] = [];
    await runApiClientCollection({
      workspace: workspace(),
      collectionId: 'collection',
      preferHostExecution: true,
      hostExecution: {
        available: true,
        endpoint: '/docs/__flexdoc/execute',
        capabilities: [],
      },
      fetcher: async (input) => {
        calls.push(String(input));
        return hostResponse();
      },
    });

    expect(calls).toEqual(['/docs/__flexdoc/execute']);
  });
});
