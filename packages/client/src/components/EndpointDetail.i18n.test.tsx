import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EndpointDetail } from './EndpointDetail';
import type { OpenAPISpec } from '../types/openapi';

jest.mock('./SchemaView', () => ({ SchemaView: () => <div data-testid='schema-view' /> }));
jest.mock('./CodeBlock', () => ({ CodeBlock: ({ title }: { title?: string }) => <div>{title}</div> }));
jest.mock('./TryItApiClientWorkspace', () => ({ TryItApiClientWorkspace: () => <div data-testid='try-it' /> }));

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Localized API', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        summary: 'Lister les animaux',
        parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Succès' } },
      },
    },
  },
};

describe('EndpointDetail localization', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('applies locale metadata and host-provided operation section messages', () => {
    const { container } = render(<EndpointDetail
      spec={spec}
      path='/pets'
      method='get'
      options={{
        locale: 'fr',
        tryIt: { enabled: false },
        codeSamples: { enabled: false },
        messages: { parameters: 'Paramètres', responses: 'Réponses' },
      }}
    />);

    expect(container.firstElementChild).toHaveAttribute('lang', 'fr');
    expect(screen.getByText('Lister les animaux')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paramètres' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réponses' })).toBeInTheDocument();
  });
});
