import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ApiClientHistory } from './ApiClientHistory';
import { createDefaultApiClientWorkspace } from '../utils/api-client-workspace';
import { createApiClientTransportRecorder, recordApiClientTransportOutcome, resetApiClientTransportObservation } from '../utils/api-client-transport-observation';

describe('history panel transport observation export', () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    resetApiClientTransportObservation();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { written.push(text); } },
    });
  });

  const panel = () => render(<ApiClientHistory
    workspace={createDefaultApiClientWorkspace()}
    onWorkspaceChange={() => {}}
    onLoadRequest={() => {}}
    theme='light'
  />);

  test('copies an aggregate report naming its schema and its host-side pair', async () => {
    recordApiClientTransportOutcome({ response: { transport: 'api-host', status: 200, responseTime: 100, hostRoundTripTime: 140 } });
    panel();

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(written).toHaveLength(1);
    const report = JSON.parse(written[0]);
    expect(report.schema).toBe('flexdoc.api-client.transport-observation/1');
    expect(report.pairsWith).toBe('flexdoc.host-execution.observation/1');
    expect(report.observation.byTransport['api-host'].attempts).toBe(1);
    expect(report.observation.byTransport['api-host'].hostOverhead).toMatchObject({ minMs: 40 });
  });

  test('reset starts a new window without clearing history', async () => {
    recordApiClientTransportOutcome({ response: { transport: 'browser', status: 200, responseTime: 50 } });
    panel();

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    const report = JSON.parse(written[0]);
    expect(report.observation.executions).toBe(0);
    expect(report.observation.windowStart).toBeNull();
  });

  test('an independent recorder does not receive shared-recorder activity', () => {
    const isolated = createApiClientTransportRecorder();
    recordApiClientTransportOutcome({ response: { transport: 'browser', status: 200, responseTime: 50 } });

    expect(isolated.snapshot().executions).toBe(0);
  });
});
