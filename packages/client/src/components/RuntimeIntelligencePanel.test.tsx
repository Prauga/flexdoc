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
  validation: {
    status: 'fail' as const,
    complete: true,
    findings: [
      {
        id: 'runtime.operation-unobserved:GET:/missing',
        code: 'runtime.operation-unobserved' as const,
        severity: 'error' as const,
        location: { kind: 'operation' as const, method: 'GET', path: '/missing' },
        message: 'OpenAPI documents GET /missing, but the running backend does not expose that operation.',
        expected: 'Operation is exposed by the running backend',
        observed: 'No matching runtime operation exists',
      },
      {
        id: 'runtime.operation-undocumented:POST:/internal/reindex',
        code: 'runtime.operation-undocumented' as const,
        severity: 'warning' as const,
        location: { kind: 'operation' as const, method: 'POST', path: '/internal/reindex' },
        message: 'Runtime implements POST /internal/reindex, but OpenAPI does not document that operation.',
        expected: 'Operation is represented in OpenAPI',
        observed: 'Operation exists only in the running backend',
      },
    ],
    summary: { total: 2, errors: 1, warnings: 1, info: 0 },
  },
};

describe('RuntimeIntelligencePanel', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('shows runtime metadata and structured 3.1 contract findings', () => {
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={() => undefined} snapshot={snapshot} />);
    expect(screen.getByText('FAIL · 2 findings')).toBeInTheDocument();
    expect(screen.getByText('1 errors · 1 warnings · 0 info')).toBeInTheDocument();
    expect(screen.getByText('runtime.operation-unobserved')).toBeInTheDocument();
    expect(screen.getByText('runtime.operation-undocumented')).toBeInTheDocument();
    expect(screen.getByText('Expected: Operation is exposed by the running backend')).toBeInTheDocument();
    expect(screen.getByText('Observed: No matching runtime operation exists')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('node v22.22.3')).toBeInTheDocument();
    expect(screen.getByText('linux · x64')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('Backend listener port 8443')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('opens a documented operation directly from an actionable validation finding', () => {
    const select = jest.fn();
    const close = jest.fn();
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={close} onEndpointSelect={select} snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open runtime route GET /missing' }));
    expect(select).toHaveBeenCalledWith('/missing', 'GET');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('falls back to 3.0 route drift when structured validation is absent', () => {
    render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={() => undefined} snapshot={{ ...snapshot, validation: undefined }} />);
    expect(screen.getByText('/internal/reindex')).toBeInTheDocument();
    expect(screen.getByText('/missing')).toBeInTheDocument();
    expect(screen.getByText('Implemented but undocumented')).toBeInTheDocument();
    expect(screen.getByText('Documented but not observed')).toBeInTheDocument();
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

    rerender(<RuntimeIntelligencePanel open theme='dark' loading={false} onClose={() => undefined} snapshot={{ ...snapshot, validation: undefined, discoveryComplete: false }} />);
    expect(screen.getByText(/Route discovery is partial/)).toHaveClass('bg-amber-950/50', 'text-amber-200');
  });
});
