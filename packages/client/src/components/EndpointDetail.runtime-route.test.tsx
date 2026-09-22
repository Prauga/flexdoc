// The repo-wide React mock returns the initial state on every render, so a
// stale useState value cannot be observed. This file uses real React.
jest.unmock('react');

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EndpointDetail } from './EndpointDetail';
import type { OpenAPISpec } from '../types/openapi';
import type { FlexDocRuntimeIntelligenceSnapshot } from '../types/options';

jest.mock('./SchemaView', () => ({ SchemaView: () => <div /> }));
jest.mock('./CodeBlock', () => ({ CodeBlock: () => <div /> }));
jest.mock('./TryItApiClientWorkspace', () => ({ TryItApiClientWorkspace: () => <div /> }));

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Pets', version: '1.0.0' },
  paths: { '/pets': { get: { summary: 'List pets', responses: { '200': { description: 'ok' } } } } },
};

const snapshot: FlexDocRuntimeIntelligenceSnapshot = {
  framework: 'express',
  runtime: { name: 'node', version: 'v22', platform: 'linux', arch: 'x64' },
  discoveryComplete: true,
  routes: [{ method: 'POST', path: '/internal/reindex' }],
  runtimeOnly: [{ method: 'POST', path: '/internal/reindex' }],
  documentedOnly: [],
  summary: { documented: 1, runtime: 1, matched: 0, runtimeOnly: 1, documentedOnly: 0 },
};

describe('EndpointDetail runtime-only routes', () => {
  it('opens a registered route that OpenAPI does not document', () => {
    render(<EndpointDetail spec={spec} path='/internal/reindex' method='POST' runtimeSnapshot={snapshot} />);
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/internal/reindex')).toBeInTheDocument();
    expect(screen.getByText('The running service registers this operation. OpenAPI does not document it.')).toBeInTheDocument();
  });

  it('opens the registered route in the API Client and prefers host execution when it is available', () => {
    const open = jest.fn();
    render(<EndpointDetail
      spec={spec}
      path='/internal/reindex'
      method='post'
      runtimeSnapshot={{ ...snapshot, serverOrigin: 'https://api.example.test' }}
      onOpenInApiClient={open}
      options={{ tryIt: { hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] } } }}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://api.example.test',
      request: expect.objectContaining({
        method: 'POST',
        url: 'https://api.example.test/internal/reindex',
        hostExecution: { preferHostExecution: true },
      }),
    }));
  });

  it('keeps a browser request when host execution is unavailable', () => {
    const open = jest.fn();
    render(<EndpointDetail spec={spec} path='/internal/reindex' method='POST' runtimeSnapshot={snapshot} onOpenInApiClient={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));
    expect(open.mock.calls[0][0].request.hostExecution).toBeUndefined();
    expect(open.mock.calls[0][0].request.url).toBe('/internal/reindex');
  });

  it('keeps an unknown path as operation not found', () => {
    render(<EndpointDetail spec={spec} path='/missing' method='GET' runtimeSnapshot={snapshot} />);
    expect(screen.getByText('Operation not found.')).toBeInTheDocument();
  });

  it('renders a documented operation after a runtime-only route in the same instance', () => {
    const { rerender } = render(<EndpointDetail spec={spec} path='/internal/reindex' method='POST' runtimeSnapshot={snapshot} />);
    expect(screen.getByText('The running service registers this operation. OpenAPI does not document it.')).toBeInTheDocument();
    rerender(<EndpointDetail spec={spec} path='/pets' method='GET' runtimeSnapshot={snapshot} />);
    expect(screen.queryByText('Operation not found.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'List pets' })).toBeInTheDocument();
  });
});
