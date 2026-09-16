import {
  createHostExecutionAdmissionRejectionMetricUpdate,
  createHostExecutionCompleteMetricUpdates,
  createHostExecutionStartMetricUpdates,
  emitHostExecutionMetricUpdates,
  type FlexDocHostExecutionMetricUpdate,
} from './host-execution-metrics';
import { createHostExecutionCompleteEvent } from './host-execution-observability';

describe('host execution operator metrics', () => {
  it('defines low-cardinality start updates for request rate and in-flight work', () => {
    expect(createHostExecutionStartMetricUpdates()).toEqual([
      { name: 'flexdoc_execute_requests_total', kind: 'counter', value: 1 },
      { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: 1 },
    ]);
  });

  it('maps completion outcome to completion, latency, and route-rejection updates', () => {
    const rejected = createHostExecutionCompleteEvent({
      executionId: 'exec-1',
      method: 'GET',
      durationMs: 1250,
      outcome: 'rejected',
      statusCode: 403,
    });

    expect(createHostExecutionCompleteMetricUpdates(rejected)).toEqual([
      { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: -1 },
      { name: 'flexdoc_execute_completions_total', kind: 'counter', value: 1, labels: { outcome: 'rejected' } },
      { name: 'flexdoc_execute_duration_seconds', kind: 'histogram', value: 1.25, labels: { outcome: 'rejected' } },
      { name: 'flexdoc_execute_rejections_total', kind: 'counter', value: 1, labels: { source: 'route', statusCode: 403 } },
    ]);
  });

  it('keeps admission 429s distinct from validated route rejections', () => {
    expect(createHostExecutionAdmissionRejectionMetricUpdate()).toEqual({
      name: 'flexdoc_execute_rejections_total',
      kind: 'counter',
      value: 1,
      labels: { source: 'admission', statusCode: 429 },
    });
  });

  it('never puts correlation, request, target, or credential data into metric updates', () => {
    const event = createHostExecutionCompleteEvent({
      executionId: 'secret-exec-id',
      method: 'POST',
      durationMs: 4,
      outcome: 'success',
      statusCode: 200,
    });
    const serialized = JSON.stringify([
      ...createHostExecutionStartMetricUpdates(),
      ...createHostExecutionCompleteMetricUpdates(event),
    ]);

    expect(serialized).not.toContain('secret-exec-id');
    expect(serialized).not.toContain('POST');
    expect(serialized).not.toContain('url');
    expect(serialized).not.toContain('body');
    expect(serialized).not.toContain('authorization');
  });

  it('keeps synchronous and asynchronous sink failures non-fatal', async () => {
    const updates = createHostExecutionStartMetricUpdates();
    expect(() => emitHostExecutionMetricUpdates(() => { throw new Error('sync'); }, updates)).not.toThrow();
    expect(() => emitHostExecutionMetricUpdates(async () => { throw new Error('async'); }, updates)).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it('delivers every update to a healthy sink', () => {
    const seen: FlexDocHostExecutionMetricUpdate[] = [];
    emitHostExecutionMetricUpdates((update) => { seen.push(update); }, createHostExecutionStartMetricUpdates());
    expect(seen).toEqual(createHostExecutionStartMetricUpdates());
  });
});
