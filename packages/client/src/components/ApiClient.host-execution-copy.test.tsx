import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClient } from './ApiClient';

describe.each(['advanced', 'basic'] as const)('API Client %s density host copy', (density) => {
  test('shows API-host policy for an available host with no advanced capabilities', () => {
    render(<ApiClient density={density} initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }} />);
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('API host');
    expect(screen.getByRole('status', { name: 'Host execution status' })).toHaveTextContent('This request runs from your API server.');
  });

  test('derives browser transport from a persisted per-request override', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', hostExecution: { preferHostExecution: false } }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [], preferHostExecution: true }}
    />);
    expect(screen.getByLabelText('Transport preference')).toHaveValue('browser');
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('Browser');
    expect(screen.queryByText('This request runs from your API server.')).not.toBeInTheDocument();
  });

  test('marks browser-incompatible requests as host required and locks preference overrides', () => {
    render(<ApiClient density={density} initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', auth: { type: 'digest', username: 'u', password: 'p' } }} hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['digest'] }} />);
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('Host required');
    expect(screen.getByLabelText('Transport preference')).toBeDisabled();
  });
});
