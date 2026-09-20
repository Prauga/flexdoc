import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClient } from './ApiClient';

describe.each(['advanced', 'basic'] as const)('API Client %s density host copy', (density) => {
  test('shows API-host policy for an available host with no advanced capabilities', () => {
    render(<ApiClient density={density} initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }} />);
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('API host');
    const status = screen.getByRole('status', { name: 'Host execution status' });
    expect(status).toHaveTextContent('This request runs from your API server.');
    expect(status).toHaveTextContent('Universal');
    expect(status).toHaveTextContent('Universal: HTTP method, URL, query, headers, body');
    expect(status).toHaveTextContent('Host-specific');
    expect(status).toHaveTextContent('None advertised.');
  });

  test('derives browser transport from a persisted per-request override', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', hostExecution: { preferHostExecution: false } }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['cookies'], preferHostExecution: true }}
    />);
    expect(screen.getByLabelText('Transport preference')).toHaveValue('browser');
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('Browser');
    const status = screen.getByRole('status', { name: 'Host execution status' });
    expect(status).toHaveTextContent('FlexDoc API host is available.');
    expect(status).toHaveTextContent('Cookie jar');
    expect(screen.queryByText('This request runs from your API server.')).not.toBeInTheDocument();
  });

  test('shows universal host capabilities even when browser transport is selected and no advanced capabilities are advertised', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', hostExecution: { preferHostExecution: false } }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }}
    />);
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('Browser');
    const status = screen.getByRole('status', { name: 'Host execution status' });
    expect(status).toHaveTextContent('FlexDoc API host is available.');
    expect(status).toHaveTextContent('Universal');
    expect(status).toHaveTextContent('None advertised.');
  });

  test('marks browser-incompatible requests as host required and locks preference overrides', () => {
    render(<ApiClient density={density} initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', auth: { type: 'digest', username: 'u', password: 'p' } }} hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['digest'] }} />);
    expect(screen.getByLabelText('Request transport')).toHaveTextContent('Host required');
    expect(screen.getByLabelText('Transport preference')).toBeDisabled();
  });

  test('explains advertised API-host capabilities with FlexDoc-owned labels', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['cookies', 'clientCertificates', 'awsv4'] }}
    />);

    const status = screen.getByRole('status', { name: 'Host execution status' });
    expect(status).toHaveTextContent('This request runs from your API server.');
    expect(status).toHaveTextContent('API host capabilities');
    expect(status).toHaveTextContent('Universal');
    expect(status).toHaveTextContent('Universal: HTTP method, URL, query, headers, body');
    expect(status).toHaveTextContent('Host-specific');
    expect(status).toHaveTextContent('Cookie jar');
    expect(status).toHaveTextContent('Client certificates (mTLS)');
    expect(status).toHaveTextContent('AWS Signature V4');
  });

  test('humanizes missing host capabilities', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets', auth: { type: 'digest', username: 'u', password: 'p' } }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }}
    />);
    const alert = screen.getByRole('alert', { name: 'Host execution status' });
    expect(alert).toHaveTextContent('The API host does not support: Digest auth.');
    expect(alert).not.toHaveTextContent('digest');
  });
});
