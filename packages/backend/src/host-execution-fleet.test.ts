import {
  mergeHostExecutionObservationDocuments,
  mergeHostExecutionObservationReports,
} from './host-execution-fleet';
import {
  createHostExecutionObservationReport,
  type FlexDocHostExecutionObservation,
  type FlexDocHostExecutionObservationReport,
} from './host-execution-observation';

function observation(overrides: Partial<FlexDocHostExecutionObservation> = {}): FlexDocHostExecutionObservation {
  return {
    windowStart: '2026-09-21T10:00:00.000Z',
    windowEnd: '2026-09-21T10:05:00.000Z',
    startedExecutions: 0,
    unmarkedRequests: 0,
    completedExecutions: 0,
    outcomes: { success: 0, rejected: 0, error: 0 },
    inFlight: 0,
    peakInFlight: 0,
    rejectionsByReason: {},
    errorsByReason: {},
    durations: null,
    ...overrides,
  };
}

function report(overrides: Partial<FlexDocHostExecutionObservation> = {}): FlexDocHostExecutionObservationReport {
  return createHostExecutionObservationReport(observation(overrides), '2026-09-21T10:05:00.000Z');
}

describe('host-execution fleet merge', () => {
  it('adds the counts that are additive', () => {
    const merged = mergeHostExecutionObservationReports([
      report({
        startedExecutions: 10,
        unmarkedRequests: 2,
        completedExecutions: 9,
        outcomes: { success: 7, rejected: 1, error: 1 },
        rejectionsByReason: { 'destination-forbidden': 1 },
        errorsByReason: { 'upstream-timeout': 1 },
      }),
      report({
        startedExecutions: 5,
        unmarkedRequests: 1,
        completedExecutions: 5,
        outcomes: { success: 3, rejected: 2, error: 0 },
        rejectionsByReason: { 'destination-forbidden': 2, 'body-malformed': 1 },
      }),
    ]);

    expect(merged.instanceCount).toBe(2);
    expect(merged.totals.startedExecutions).toBe(15);
    expect(merged.totals.unmarkedRequests).toBe(3);
    expect(merged.totals.completedExecutions).toBe(14);
    expect(merged.totals.outcomes).toEqual({ success: 10, rejected: 3, error: 1 });
    expect(merged.totals.rejectionsByReason).toEqual({ 'destination-forbidden': 3, 'body-malformed': 1 });
    expect(merged.totals.errorsByReason).toEqual({ 'upstream-timeout': 1 });
  });

  // Two instances each peaking at 8 may never have peaked together, so the sum is a
  // bound. Naming it as a peak would invite sizing decisions against a number that
  // was never observed.
  it('reports summed peaks as an upper bound, not as a peak', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ inFlight: 2, peakInFlight: 8 }),
      report({ inFlight: 1, peakInFlight: 5 }),
    ]);

    expect(merged.concurrency.inFlightAtSnapshot).toBe(3);
    expect(merged.concurrency.peakInFlightUpperBound).toBe(13);
    expect(merged.concurrency.peakInFlightSingleInstanceMax).toBe(8);
    expect(merged.concurrency).not.toHaveProperty('peakInFlight');
  });

  it('unions the contributing windows', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ windowStart: '2026-09-21T10:02:00.000Z', windowEnd: '2026-09-21T10:09:00.000Z' }),
      report({ windowStart: '2026-09-21T09:58:00.000Z', windowEnd: '2026-09-21T10:04:00.000Z' }),
    ]);

    expect(merged.window).toEqual({
      start: '2026-09-21T09:58:00.000Z',
      end: '2026-09-21T10:09:00.000Z',
    });
  });

  it('ignores instances that observed nothing when bounding the window', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ windowStart: null, windowEnd: null }),
      report({ windowStart: '2026-09-21T10:00:00.000Z', windowEnd: '2026-09-21T10:05:00.000Z' }),
    ]);

    expect(merged.window).toEqual({
      start: '2026-09-21T10:00:00.000Z',
      end: '2026-09-21T10:05:00.000Z',
    });
  });

  it('leaves the window null when no instance observed anything', () => {
    const merged = mergeHostExecutionObservationReports([report({ windowStart: null, windowEnd: null })]);

    expect(merged.window).toEqual({ start: null, end: null });
    expect(merged.durations).toBeNull();
  });

  // A percentile cannot be recovered from other percentiles, and the samples do not
  // travel in the per-instance documents. Reporting a fleet p95 would be a guess
  // presented as evidence, so the merge reports what it can prove instead.
  it('refuses to invent fleet percentiles across instances', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ durations: { sampleCount: 100, sampled: false, minMs: 5, p50Ms: 40, p95Ms: 90, p99Ms: 120, maxMs: 200 } }),
      report({ durations: { sampleCount: 50, sampled: true, minMs: 2, p50Ms: 60, p95Ms: 300, p99Ms: 400, maxMs: 700 } }),
    ]);

    expect(merged.durations).not.toBeNull();
    expect(merged.durations!.percentiles).toBeNull();
    expect(merged.durations!.minMs).toBe(2);
    expect(merged.durations!.maxMs).toBe(700);
    expect(merged.durations!.sampleCount).toBe(150);
    expect(merged.durations!.sampled).toBe(true);
    expect(merged.durations!.reportingInstances).toBe(2);
    expect(merged.durations!.p95SpreadMs).toBe(210);
    expect(merged.gaps).toContain('cross-instance-duration-percentiles');
  });

  // The gap is declared only when it exists: with one instance the percentiles are
  // that instance's own and need no disclaimer.
  it('keeps percentiles when only one instance contributed', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ durations: { sampleCount: 100, sampled: false, minMs: 5, p50Ms: 40, p95Ms: 90, p99Ms: 120, maxMs: 200 } }),
    ]);

    expect(merged.durations!.percentiles).toEqual({ p50Ms: 40, p95Ms: 90, p99Ms: 120 });
    expect(merged.durations!.p95SpreadMs).toBe(0);
    expect(merged.gaps).not.toContain('cross-instance-duration-percentiles');
  });

  it('keeps every per-instance summary so a slow instance is identifiable', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ durations: { sampleCount: 10, sampled: false, minMs: 1, p50Ms: 5, p95Ms: 9, p99Ms: 10, maxMs: 11 } }),
      report({ durations: null }),
      report({ durations: { sampleCount: 20, sampled: false, minMs: 2, p50Ms: 50, p95Ms: 400, p99Ms: 500, maxMs: 600 } }),
    ]);

    expect(merged.durations!.reportingInstances).toBe(2);
    expect(merged.durations!.perInstance.map((entry) => entry.instance)).toEqual([0, 2]);
    expect(merged.durations!.perInstance[1].p95Ms).toBe(400);
  });

  it('still declares the browser-direct gap every instance declares', () => {
    const merged = mergeHostExecutionObservationReports([report(), report()]);

    expect(merged.schema).toBe('flexdoc.host-execution.fleet-observation/1');
    expect(merged.gaps).toContain('browser-direct-transport-mix');
  });

  // An empty merge would describe a healthy fleet of nothing, which is the one answer
  // a review must never get from a collection failure.
  it('rejects an empty fleet instead of reporting a clean one', () => {
    expect(() => mergeHostExecutionObservationReports([])).toThrow(/at least one instance report/);
  });

  it('carries no request content into the fleet document', () => {
    const merged = mergeHostExecutionObservationReports([
      report({ startedExecutions: 3, rejectionsByReason: { 'destination-forbidden': 1 } }),
      report({ startedExecutions: 4 }),
    ]);

    expect(JSON.stringify(merged)).not.toMatch(/https?:|token|cookie|Authorization/i);
  });

  describe('collected as JSON', () => {
    it('merges parsed documents', () => {
      const documents = JSON.parse(JSON.stringify([report({ startedExecutions: 2 }), report({ startedExecutions: 3 })]));
      const merged = mergeHostExecutionObservationDocuments(documents, '2026-09-21T11:00:00.000Z');

      expect(merged.totals.startedExecutions).toBe(5);
      expect(merged.generatedAt).toBe('2026-09-21T11:00:00.000Z');
    });

    // A document from an unknown schema merged silently would corrupt the totals
    // without changing their shape, which is undetectable downstream.
    it('names the instance and schema it rejected', () => {
      expect(() => mergeHostExecutionObservationDocuments([
        JSON.parse(JSON.stringify(report())),
        { schema: 'flexdoc.host-execution.observation/2', observation: {} },
      ])).toThrow(/instance 1.*saw flexdoc\.host-execution\.observation\/2/);

      expect(() => mergeHostExecutionObservationDocuments([{}])).toThrow(/saw missing/);
      expect(() => mergeHostExecutionObservationDocuments([null])).toThrow(/saw missing/);
    });
  });
});
