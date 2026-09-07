import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';

const snapshot = {
  framework: 'express',
  runtime: { name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' },
  serverOrigin: 'https://api.example.com',
  server: { localPort: 8443 },
  environment: { name: 'production' },
  discoveryComplete: true,
  routes: [{ method: 'GET', path: '/pets' }],
  runtimeOnly: [{ method: 'POST', path: '/internal/reindex' }],
  documentedOnly: [{ method: 'GET', path: '/missing' }],
  summary: { documented: 2, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 1 },
};

describe('RuntimeIntelligencePanel', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('shows runtime metadata, safe environment context, and route drift', () => {
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={() => undefined} snapshot={snapshot} />);
    expect(screen.getByText('/internal/reindex')).toBeInTheDocument();
    expect(screen.getByText('/missing')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('node v22.22.3')).toBeInTheDocument();
    expect(screen.getByText('linux · x64')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('Backend listener port 8443')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('closes on Escape, traps focus, and locks body scroll', async () => {
    const close = jest.fn();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={close} />);
    const closeButton = screen.getByLabelText('Close runtime intelligence panel');
    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    opener.remove();
  });

  it('uses dark-mode warning and error surfaces', () => {
    const { rerender } = render(<RuntimeIntelligencePanel open theme='dark' loading={false} error='Unavailable' onClose={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveClass('bg-red-950/50', 'text-red-200');

    rerender(<RuntimeIntelligencePanel open theme='dark' loading={false} onClose={() => undefined} snapshot={{ ...snapshot, discoveryComplete: false }} />);
    expect(screen.getByText(/Route discovery is partial/)).toHaveClass('bg-amber-950/50', 'text-amber-200');
  });
});
