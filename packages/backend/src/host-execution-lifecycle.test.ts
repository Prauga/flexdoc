import * as http from 'http';
import { createHostExecutionState } from './host-execution';
import type { FlexDocHostExecutionMetricUpdate } from './host-execution-metrics';
import { runHostExecutionRoute } from './host-execution-route';
import type { FlexDocHostExecutionCompleteEvent, FlexDocHostExecutionStartEvent } from './host-execution-observability';

const headers = { 'content-type': 'application/json', 'x-flexdoc-execute': '1' };

describe('host execution lifecycle hooks', () => {
  it('emits one correlated start/completion pair and operator metrics for a successful execution', async () => {
    const server = http.createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const starts: FlexDocHostExecutionStartEvent[] = [];
    const completes: FlexDocHostExecutionCompleteEvent[] = [];
    const metrics: FlexDocHostExecutionMetricUpdate[] = [];

    try {
      const state = createHostExecutionState({
        allowedOrigins: [origin],
        onHostExecutionStart: (event) => {
          starts.push(event);
        },
        onHostExecutionComplete: (event) => {
          completes.push(event);
        },
        onHostExecutionMetric: (update) => {
          metrics.push(update);
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
      expect(metrics).toEqual(expect.arrayContaining([
        { name: 'flexdoc_execute_requests_total', kind: 'counter', value: 1 },
        { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: 1 },
        { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: -1 },
        { name: 'flexdoc_execute_completions_total', kind: 'counter', value: 1, labels: { outcome: 'success' } },
      ]));
      const latency = metrics.find((update) => update.name === 'flexdoc_execute_duration_seconds');
      expect(latency).toMatchObject({ kind: 'histogram', labels: { outcome: 'success' } });
      expect(latency?.value).toBeGreaterThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('reports policy rejection after a validated envelope without exposing the target', async () => {
    const starts: FlexDocHostExecutionStartEvent[] = [];
    const completes: FlexDocHostExecutionCompleteEvent[] = [];
    const metrics: FlexDocHostExecutionMetricUpdate[] = [];
    const state = createHostExecutionState({
      allowedOrigins: ['https://allowed.example.test'],
      onHostExecutionStart: (event) => {
        starts.push(event);
      },
      onHostExecutionComplete: (event) => {
        completes.push(event);
      },
      onHostExecutionMetric: (update) => {
        metrics.push(update);
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
    expect(metrics).toContainEqual({
      name: 'flexdoc_execute_rejections_total',
      kind: 'counter',
      value: 1,
      labels: { source: 'route', statusCode: 403 },
    });
    expect(JSON.stringify([...starts, ...completes, ...metrics])).not.toContain('blocked.example.test');
    expect(JSON.stringify([...starts, ...completes, ...metrics])).not.toContain('secret');
  });

  it('does not emit execution hooks or lifecycle metrics before a valid execution envelope', async () => {
    const onHostExecutionStart = jest.fn();
    const onHostExecutionComplete = jest.fn();
    const onHostExecutionMetric = jest.fn();
    const state = createHostExecutionState({
      allowedOrigins: ['https://api.example.test'],
      onHostExecutionStart,
      onHostExecutionComplete,
      onHostExecutionMetric,
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
    expect(onHostExecutionMetric).not.toHaveBeenCalled();
  });

  it('keeps observer and metric failures off the execution path', async () => {
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
        onHostExecutionMetric: () => { throw new Error('metric observer failed'); },
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
