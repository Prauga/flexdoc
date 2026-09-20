import {
  createHostExecutionObservationRecorder,
  createHostExecutionObservationReport,
} from './host-execution-observation';
import {
  createHostExecutionAdmissionRejectionMetricUpdate,
  createHostExecutionCompleteMetricUpdates,
  createHostExecutionStartMetricUpdates,
  createHostExecutionUnmarkedMetricUpdate,
} from './host-execution-metrics';
import { createHostExecutionCompleteEvent, hostExecutionReasons } from './host-execution-observability';
import type { FlexDocHostExecutionOutcome, FlexDocHostExecutionReason } from './host-execution-observability';

function completion(
  outcome: FlexDocHostExecutionOutcome,
  durationMs: number,
  statusCode?: number,
  reason?: FlexDocHostExecutionReason,
) {
  return createHostExecutionCompleteMetricUpdates(
    createHostExecutionCompleteEvent({ executionId: 'exec', method: 'GET', durationMs, outcome, statusCode, reason }),
  );
}

describe('host execution observation recorder', () => {
  it('counts starts, completions, outcomes, and peak concurrency', () => {
    const recorder = createHostExecutionObservationRecorder();

    for (let index = 0; index < 3; index += 1) createHostExecutionStartMetricUpdates().forEach(recorder.sink);
    completion('success', 10, 200).forEach(recorder.sink);
    completion('rejected', 4, 403, 'destination-forbidden').forEach(recorder.sink);

    const snapshot = recorder.snapshot();
    expect(snapshot.startedExecutions).toBe(3);
    expect(snapshot.completedExecutions).toBe(2);
    expect(snapshot.outcomes).toEqual({ success: 1, rejected: 1, error: 0 });
    expect(snapshot.inFlight).toBe(1);
    expect(snapshot.peakInFlight).toBe(3);
  });

  it('tallies rejections and upstream failures by stable reason', () => {
    const recorder = createHostExecutionObservationRecorder();

    completion('rejected', 2, 400, 'body-too-large').forEach(recorder.sink);
    completion('rejected', 3, 403, 'destination-forbidden').forEach(recorder.sink);
    completion('error', 30_000, 502, 'upstream-timeout').forEach(recorder.sink);
    recorder.sink(createHostExecutionAdmissionRejectionMetricUpdate());

    const snapshot = recorder.snapshot();
    expect(snapshot.rejectionsByReason).toEqual({
      'body-too-large': 1,
      'destination-forbidden': 1,
      'admission-saturated': 1,
    });
    expect(snapshot.errorsByReason).toEqual({ 'upstream-timeout': 1 });
  });

  it('counts unmarked requests without treating them as executions or rejections', () => {
    const recorder = createHostExecutionObservationRecorder();

    recorder.sink(createHostExecutionUnmarkedMetricUpdate());
    recorder.sink(createHostExecutionUnmarkedMetricUpdate());
    createHostExecutionStartMetricUpdates().forEach(recorder.sink);

    const snapshot = recorder.snapshot();
    expect(snapshot.unmarkedRequests).toBe(2);
    expect(snapshot.startedExecutions).toBe(1);
    expect(snapshot.rejectionsByReason).toEqual({});
  });

  it('reports exact percentiles while every duration is retained', () => {
    const recorder = createHostExecutionObservationRecorder();

    for (let ms = 1; ms <= 100; ms += 1) completion('success', ms, 200).forEach(recorder.sink);

    expect(recorder.snapshot().durations).toEqual({
      sampleCount: 100,
      sampled: false,
      minMs: 1,
      p50Ms: 50,
      p95Ms: 95,
      p99Ms: 99,
      maxMs: 100,
    });
  });

  it('bounds retained durations and marks the distribution as sampled', () => {
    // Replacement always targets the first slot, so the retained sample is
    // deterministic and the capacity bound is observable.
    const recorder = createHostExecutionObservationRecorder({ durationSampleCapacity: 4, random: () => 0 });

    for (const ms of [10, 20, 30, 40, 50, 60]) completion('success', ms, 200).forEach(recorder.sink);

    const durations = recorder.snapshot().durations;
    expect(durations?.sampleCount).toBe(4);
    expect(durations?.sampled).toBe(true);
    expect(recorder.snapshot().completedExecutions).toBe(6);
  });

  it('has no duration summary before the first completion', () => {
    const recorder = createHostExecutionObservationRecorder();

    createHostExecutionStartMetricUpdates().forEach(recorder.sink);

    expect(recorder.snapshot().durations).toBeNull();
    expect(recorder.snapshot().windowStart).not.toBeNull();
  });

  it('bounds the window by the first and last recorded update', () => {
    const times = [1_000, 5_000, 9_000];
    let index = 0;
    const recorder = createHostExecutionObservationRecorder({ now: () => times[Math.min(index++, times.length - 1)] });

    createHostExecutionStartMetricUpdates().slice(0, 1).forEach(recorder.sink);
    createHostExecutionStartMetricUpdates().slice(0, 1).forEach(recorder.sink);
    createHostExecutionStartMetricUpdates().slice(0, 1).forEach(recorder.sink);

    const snapshot = recorder.snapshot();
    expect(snapshot.windowStart).toBe(new Date(1_000).toISOString());
    expect(snapshot.windowEnd).toBe(new Date(9_000).toISOString());
  });

  it('starts an empty window after reset', () => {
    const recorder = createHostExecutionObservationRecorder();

    completion('success', 10, 200).forEach(recorder.sink);
    recorder.reset();

    expect(recorder.snapshot()).toEqual({
      windowStart: null,
      windowEnd: null,
      startedExecutions: 0,
      unmarkedRequests: 0,
      completedExecutions: 0,
      outcomes: { success: 0, rejected: 0, error: 0 },
      inFlight: 0,
      peakInFlight: 0,
      rejectionsByReason: {},
      errorsByReason: {},
      durations: null,
    });
  });

  it('carries only counts, timestamps, and known category names', () => {
    const recorder = createHostExecutionObservationRecorder();

    completion('success', 12, 200).forEach(recorder.sink);
    completion('rejected', 3, 403, 'destination-forbidden').forEach(recorder.sink);

    // Rather than searching for known-bad substrings, assert the whole document
    // from the other direction: every leaf is a number, a boolean, a timestamp,
    // or a value drawn from a fixed vocabulary. A request id, URL, header, or
    // error message could not satisfy that.
    const allowed = new Set<string>([
      'flexdoc.host-execution.observation/1',
      'browser-direct-transport-mix',
      ...hostExecutionReasons(),
    ]);
    const walk = (value: unknown, path: string): void => {
      if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
      if (typeof value === 'string') {
        if (allowed.has(value)) return;
        expect(new Date(value).toISOString()).toBe(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
        return;
      }
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        // Reason categories appear as keys of the per-reason tallies.
        if (path.endsWith('ByReason')) expect(hostExecutionReasons()).toContain(key);
        walk(entry, `${path}.${key}`);
      }
    };

    walk(createHostExecutionObservationReport(recorder.snapshot()), 'report');
  });
});

describe('host execution observation report', () => {
  it('declares the transport-mix gap an API host cannot fill', () => {
    const recorder = createHostExecutionObservationRecorder();

    const report = createHostExecutionObservationReport(recorder.snapshot(), '2026-09-21T00:00:00.000Z');

    expect(report.schema).toBe('flexdoc.host-execution.observation/1');
    expect(report.generatedAt).toBe('2026-09-21T00:00:00.000Z');
    expect(report.gaps).toEqual(['browser-direct-transport-mix']);
  });
});
