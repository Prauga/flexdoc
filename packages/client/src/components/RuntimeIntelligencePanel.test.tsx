import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';

describe('RuntimeIntelligencePanel', () => {
  it('shows runtime metadata plus runtime-only and documented-only routes', () => {
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={() => undefined} snapshot={{
      framework: 'express',
      runtime: { name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' },
      discoveryComplete: true,
      routes: [{ method: 'GET', path: '/pets' }],
      runtimeOnly: [{ method: 'POST', path: '/internal/reindex' }],
      documentedOnly: [{ method: 'GET', path: '/missing' }],
      summary: { documented: 2, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 1 },
    }} />);
    expect(screen.getByText('/internal/reindex')).toBeInTheDocument();
    expect(screen.getByText('/missing')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('node v22.22.3')).toBeInTheDocument();
    expect(screen.getByText('linux · x64')).toBeInTheDocument();
  });

  it('closes from the panel button', () => {
    const close = jest.fn();
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={close} />);
    fireEvent.click(screen.getByLabelText('Close runtime intelligence panel'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
