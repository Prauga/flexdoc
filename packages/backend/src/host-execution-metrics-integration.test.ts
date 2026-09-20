import { createHostExecutionState } from './host-execution';
import type { FlexDocHostExecutionMetricUpdate } from './host-execution-metrics';
import { runHostExecutionRoute } from './host-execution-route';

const headers = { 'content-type': 'application/json', 'x-flexdoc-execute': '1' };

describe('host execution metric isolation', () => {
  it('does not let lifecycle callback mutation change fixed-cardinality metric labels', async () => {
    const metrics: FlexDocHostExecutionMetricUpdate[] = [];
    const state = createHostExecutionState({
      allowedOrigins: ['https://allowed.example.test'],
      onHostExecutionMetric: (update) => { metrics.push(update); },
      onHostExecutionComplete: (event) => {
        (event as { outcome: string }).outcome = 'secret-derived-label';
      },
    });

    const result = await runHostExecutionRoute({
      state,
      spec: {},
      headers,
      body: { request: { method: 'GET', url: 'https://blocked.example.test/private' } },
    });

    expect(result.status).toBe(403);
    expect(metrics).toContainEqual({
      name: 'flexdoc_execute_completions_total',
      kind: 'counter',
      value: 1,
      labels: { outcome: 'rejected' },
    });
    expect(metrics).toContainEqual({
      name: 'flexdoc_execute_rejections_total',
      kind: 'counter',
      value: 1,
      labels: { source: 'route', statusCode: 403 },
    });
    expect(JSON.stringify(metrics)).not.toContain('secret-derived-label');
  });
});
