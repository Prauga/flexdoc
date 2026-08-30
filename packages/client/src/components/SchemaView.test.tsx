import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaView } from './SchemaView';
import { OpenAPISpec } from '../types/openapi';

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: { title: '3.1 API', version: '1' },
  paths: {},
  components: {
    schemas: {
      Node: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          kind: { const: 'node' },
          parent: { $ref: '#/components/schemas/Node' },
          value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: ['null', 'boolean'] }] },
        },
      },
    },
  },
};

describe('SchemaView', () => {
  it('renders OpenAPI 3.1 composition and const metadata', () => {
    render(<SchemaView spec={spec} schema={{ $ref: '#/components/schemas/Node' }} theme='light' />);
    expect(screen.getByText('One of')).toBeInTheDocument();
    expect(screen.getByText('Constant: "node"')).toBeInTheDocument();
    expect(screen.getByText(/recursive reference/)).toBeInTheDocument();
    expect(screen.getByText('null | boolean')).toBeInTheDocument();
  });

  it('can order required properties before optional properties', () => {
    render(<SchemaView spec={spec} schema={{ type: 'object', required: ['z'], properties: { a: { type: 'string' }, z: { type: 'string' } } }} theme='light' requiredPropsFirst sortPropsAlphabetically />);
    const labels = screen.getAllByText(/^[az]$/).map((node) => node.textContent);
    expect(labels).toEqual(['z', 'a']);
  });
});
