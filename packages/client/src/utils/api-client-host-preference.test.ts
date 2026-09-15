import { executeApiClientRequest } from './api-client-execution';
import type { FlexDocHostExecutionPublicOptions } from '../types/options';

function response(body: string, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    text: async () => body,
  } as Response;
}

type HostExecutionWithPreference = FlexDocHostExecutionPublicOptions & { preferHostExecution?: boolean };

describe('serialized host execution preference', () => {
  it('uses direct browser transport for ordinary requests when the host preference is false', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return response('direct');
    };
    const hostExecution: HostExecutionWithPreference = {
      available: true,
      endpoint: '/docs/__flexdoc/execute',
      capabilities: [],
      preferHostExecution: false,
    };

    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/health' },
      hostExecution,
      fetcher,
    });

    expect(calls).toEqual(['https://api.example.test/health']);
    expect(outcome.response?.body).toBe('direct');
  });

  it('keeps the historical host-preferred default when old metadata omits the preference', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return response(JSON.stringify({ status: 204, statusText: 'No Content', headers: [], body: '', responseTime: 1 }));
    };

    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/health' },
      hostExecution: {
        available: true,
        endpoint: '/docs/__flexdoc/execute',
        capabilities: [],
      },
      fetcher,
    });

    expect(calls).toEqual(['/docs/__flexdoc/execute']);
    expect(outcome.response?.status).toBe(204);
  });
});
