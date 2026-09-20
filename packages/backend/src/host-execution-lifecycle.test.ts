import * as http from 'http';
import { createHostExecutionState } from './host-execution';
import { runHostExecutionRoute } from './host-execution-route';
import type { FlexDocHostExecutionCompleteEvent, FlexDocHostExecutionStartEvent } from './host-execution-observability';

const headers = { 'content-type': 'application/json', 'x-flexdoc-execute': '1' };

describe('host execution lifecycle hooks', () => {
  it('emits one correlated start/completion pair for a successful execution', async () => {
    const server = http.createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const starts: FlexDocHostExecutionStartEvent[] = [];
    const completes: FlexDocHostExecutionCompleteEvent[] = [];

    try {
      const state = createHostExecutionState({
        allowedOrigins: [origin],
        onHostExecutionStart: (event) => {
          starts.push(event);
        },
        onHostExecutionComplete: (event) => {
          completes.push(event);
        },
      });
      const result = await runHostExecutionRoute({
        state,
        spec: {},
        headers,
        body: { request: { method: 'post', url: origin } },
      });

      expect(result.status).toBe(200);
      expect(starts).toHaveLength(1);
      expect(completes).toHaveLength(1);
      expect(starts[0]).toMatchObject({ name: 'flexdoc.execute.start', method: 'POST' });
      expect(completes[0]).toMatchObject({
        name: 'flexdoc.execute.complete',
        method: 'POST',
        outcome: 'success',
        statusCode: 200,
      });
      expect(completes[0].executionId).toBe(starts[0].executionId);
      expect(completes[0].durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('reports policy rejection after a validated envelope without exposing the target', async () => {
    const starts: FlexDocHostExecutionStartEvent[] = [];
    const completes: FlexDocHostExecutionCompleteEvent[] = [];
    const state = createHostExecutionState({
      allowedOrigins: ['https://allowed.example.test'],
      onHostExecutionStart: (event) => {
        starts.push(event);
      },
      onHostExecutionComplete: (event) => {
        completes.push(event);
      },
    });

    const result = await runHostExecutionRoute({
      state,
      spec: {},
      headers,
      body: { request: { method: 'GET', url: 'https://blocked.example.test/private?token=secret' } },
    });

    expect(result.status).toBe(403);
    expect(starts).toHaveLength(1);
    expect(completes).toHaveLength(1);
    expect(completes[0]).toMatchObject({ outcome: 'rejected', statusCode: 403, method: 'GET' });
    expect(completes[0].executionId).toBe(starts[0].executionId);
    expect(JSON.stringify([...starts, ...completes])).not.toContain('blocked.example.test');
    expect(JSON.stringify([...starts, ...completes])).not.toContain('secret');
  });

  it('does not emit execution hooks for requests rejected before a valid execution envelope', async () => {
    const onHostExecutionStart = jest.fn();
    const onHostExecutionComplete = jest.fn();
    const state = createHostExecutionState({
      allowedOrigins: ['https://api.example.test'],
      onHostExecutionStart,
      onHostExecutionComplete,
    });

    const result = await runHostExecutionRoute({
      state,
      spec: {},
      headers: { 'content-type': 'application/json' },
      body: { request: { method: 'GET', url: 'https://api.example.test' } },
    });

    expect(result.status).toBe(403);
    expect(onHostExecutionStart).not.toHaveBeenCalled();
    expect(onHostExecutionComplete).not.toHaveBeenCalled();
  });

  it('keeps observer failures off the execution path', async () => {
    const server = http.createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      const state = createHostExecutionState({
        allowedOrigins: [origin],
        onHostExecutionStart: () => { throw new Error('observer failed'); },
        onHostExecutionComplete: async () => { throw new Error('async observer failed'); },
      });
      const result = await runHostExecutionRoute({
        state,
        spec: {},
        headers,
        body: { request: { method: 'GET', url: origin } },
      });
      expect(result.status).toBe(200);
      expect(JSON.parse(result.body).body).toBe('ok');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
