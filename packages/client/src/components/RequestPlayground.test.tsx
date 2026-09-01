import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequestPlayground } from './RequestPlayground';
import { requestDraftFromBuiltRequest } from '../utils/http-client';
import type { OpenAPISpec } from '../types/openapi';

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Playground API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.test' }],
  paths: {
    '/pets': {
      get: {
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'string' } },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/archived-pets': {
      get: {
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'string', default: '25' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

test('hands the exact live editor request to the API Client callback', () => {
  const onOpenInApiClient = jest.fn();
  render(<RequestPlayground spec={spec} path='/pets' method='get' theme='light' onOpenInApiClient={onOpenInApiClient} />);

  fireEvent.change(screen.getByLabelText('query limit'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('header X-Trace'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));

  expect(onOpenInApiClient).toHaveBeenCalledTimes(1);
  const request = onOpenInApiClient.mock.calls[0][0];
  expect(request.url).toBe('https://api.example.test/pets?limit=10');
  expect(request.headers).toEqual({ 'X-Trace': 'abc' });

  const draft = requestDraftFromBuiltRequest(request);
  expect(draft.url).toBe('https://api.example.test/pets');
  expect(draft.query).toEqual([{ key: 'limit', value: '10' }]);
  expect(draft.headers).toEqual([{ key: 'X-Trace', value: 'abc' }]);
});

test('resets direct-use form state when operation defaults change', () => {
  const onOpenInApiClient = jest.fn();
  const { rerender } = render(
    <RequestPlayground spec={spec} path='/pets' method='get' theme='light' onOpenInApiClient={onOpenInApiClient} />
  );

  fireEvent.change(screen.getByLabelText('query limit'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));
  expect(onOpenInApiClient.mock.calls.at(-1)?.[0].url).toBe('https://api.example.test/pets?limit=10');

  rerender(
    <RequestPlayground spec={spec} path='/archived-pets' method='get' theme='light' onOpenInApiClient={onOpenInApiClient} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));

  expect(onOpenInApiClient.mock.calls.at(-1)?.[0].url).toBe('https://api.example.test/archived-pets?limit=25');
  expect(screen.queryByLabelText('header X-Trace')).not.toBeInTheDocument();
});

test('uses an arbitrary custom server override for Try It and API Client handoff', () => {
  const onOpenInApiClient = jest.fn();
  render(<RequestPlayground spec={spec} path='/pets' method='get' theme='light' onOpenInApiClient={onOpenInApiClient} />);

  fireEvent.change(screen.getByLabelText('Custom server URL'), { target: { value: 'http://localhost:8080' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));

  expect(onOpenInApiClient).toHaveBeenCalledTimes(1);
  expect(onOpenInApiClient.mock.calls[0][0].url).toBe('http://localhost:8080/pets');
  expect(onOpenInApiClient.mock.calls[0][1]).toBe('http://localhost:8080');
});

test('offers a custom server even when the OpenAPI document has no configured servers', () => {
  const onOpenInApiClient = jest.fn();
  const serverlessSpec: OpenAPISpec = { ...spec, servers: undefined };
  render(<RequestPlayground spec={serverlessSpec} path='/pets' method='get' theme='light' onOpenInApiClient={onOpenInApiClient} />);

  expect(screen.queryByLabelText('Server')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Custom server URL'), { target: { value: 'https://spot-canary.example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open in API Client' }));

  expect(onOpenInApiClient.mock.calls[0][0].url).toBe('https://spot-canary.example.test/pets');
});
