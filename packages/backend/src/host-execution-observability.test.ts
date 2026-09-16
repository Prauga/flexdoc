import {
  createHostExecutionCompleteEvent,
  createHostExecutionStartEvent,
} from './host-execution-observability';

describe('host execution observability contract', () => {
  it('creates a normalized start event and ignores sensitive caller fields', () => {
    const event = createHostExecutionStartEvent({
      executionId: ' exec-123 ',
      method: 'post',
      timestamp: '2026-09-16T12:00:00.000Z',
      url: 'https://internal.example.test/private?token=secret',
      headers: { authorization: 'Bearer secret' },
      body: 'secret-body',
      auth: { token: 'secret' },
      cookies: ['secret-cookie'],
    } as any);

    expect(event).toEqual({
      name: 'flexdoc.execute.start',
      executionId: 'exec-123',
      timestamp: '2026-09-16T12:00:00.000Z',
      method: 'POST',
    });
    expect(Object.keys(event).sort()).toEqual(['executionId', 'method', 'name', 'timestamp']);
    expect(JSON.stringify(event)).not.toContain('secret');
    expect(JSON.stringify(event)).not.toContain('internal.example.test');
  });

  it('creates a coarse completion event without response content', () => {
    const event = createHostExecutionCompleteEvent({
      executionId: 'exec-123',
      method: 'get',
      timestamp: '2026-09-16T12:00:01.000Z',
      durationMs: 14.75,
      outcome: 'success',
      statusCode: 204,
      responseBody: 'secret-response',
      responseHeaders: { 'set-cookie': 'secret' },
    } as any);

    expect(event).toEqual({
      name: 'flexdoc.execute.complete',
      executionId: 'exec-123',
      timestamp: '2026-09-16T12:00:01.000Z',
      method: 'GET',
      durationMs: 14.75,
      outcome: 'success',
      statusCode: 204,
    });
    expect(Object.keys(event).sort()).toEqual(['durationMs', 'executionId', 'method', 'name', 'outcome', 'statusCode', 'timestamp']);
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('uses UNKNOWN when a method is unavailable and clamps negative durations', () => {
    expect(createHostExecutionStartEvent({ executionId: 'exec-1' }).method).toBe('UNKNOWN');
    expect(createHostExecutionCompleteEvent({
      executionId: 'exec-1',
      durationMs: -5,
      outcome: 'rejected',
    }).durationMs).toBe(0);
  });

  it('rejects invalid correlation, time, duration, and status metadata', () => {
    expect(() => createHostExecutionStartEvent({ executionId: '   ' })).toThrow(/non-empty execution id/i);
    expect(() => createHostExecutionStartEvent({ executionId: 'exec-1', timestamp: 'not-a-date' })).toThrow(/valid timestamp/i);
    expect(() => createHostExecutionCompleteEvent({ executionId: 'exec-1', durationMs: Number.NaN, outcome: 'error' })).toThrow(/finite duration/i);
    expect(() => createHostExecutionCompleteEvent({ executionId: 'exec-1', durationMs: 1, outcome: 'error', statusCode: 99 })).toThrow(/between 100 and 599/i);
  });
});
