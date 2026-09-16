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
    expect(outcome.response?.transport).toBe('browser');
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
    expect(outcome.response?.transport).toBe('api-host');
  });

  it('lets a saved request prefer browser over a host-preferred server policy', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => { calls.push(String(input)); return response('direct'); };
    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/health', hostExecution: { preferHostExecution: false } },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [], preferHostExecution: true },
      fetcher,
    });
    expect(calls).toEqual(['https://api.example.test/health']);
    expect(outcome.response?.transport).toBe('browser');
  });

  it('lets a saved request prefer the API host over a browser-preferred server policy', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return response(JSON.stringify({ status: 200, statusText: 'OK', headers: [], body: 'host', responseTime: 2 }));
    };
    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/health', hostExecution: { preferHostExecution: true } },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [], preferHostExecution: false },
      fetcher,
    });
    expect(calls).toEqual(['/docs/__flexdoc/execute']);
    expect(outcome.response?.transport).toBe('api-host');
  });

  it('keeps explicit caller policy above saved request preference and still forces host-only requirements', async () => {
    const directCalls: string[] = [];
    const directFetcher: typeof fetch = async (input) => { directCalls.push(String(input)); return response('direct'); };
    const direct = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/health', hostExecution: { preferHostExecution: true } },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] },
      preferHostExecution: false,
      fetcher: directFetcher,
    });
    expect(directCalls).toEqual(['https://api.example.test/health']);
    expect(direct.response?.transport).toBe('browser');

    const hostCalls: string[] = [];
    const hostFetcher: typeof fetch = async (input) => {
      hostCalls.push(String(input));
      return response(JSON.stringify({ status: 200, statusText: 'OK', headers: [], body: 'host', responseTime: 3 }));
    };
    const required = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/secure', auth: { type: 'digest', username: 'u', password: 'p' }, hostExecution: { preferHostExecution: false } },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['digest'] },
      fetcher: hostFetcher,
    });
    expect(hostCalls).toEqual(['/docs/__flexdoc/execute']);
    expect(required.response?.transport).toBe('api-host');
  });
});
