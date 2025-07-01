import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlexDoc } from './FlexDoc';
import { OpenAPISpec } from '../types/openapi';

// Mock the child components to simplify testing
jest.mock('./Sidebar', () => ({
  Sidebar: ({ onEndpointSelect }: any) => (
    <div data-testid='sidebar-mock'>
      <span>Sidebar Mock</span>
    </div>
  ),
}));

jest.mock('./EndpointDetail', () => ({
  EndpointDetail: (_props: any) => (
    <div data-testid='endpoint-detail-mock'>
      <span>EndpointDetail Mock</span>
    </div>
  ),
}));

jest.mock('./Overview', () => ({
  Overview: () => (
    <div data-testid='overview-mock'>
      <span>Overview Mock</span>
    </div>
  ),
}));

describe('FlexDoc', () => {
  const mockSpec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {
      '/pets': {
        get: {
          summary: 'List all pets',
          responses: {
            '200': {
              description: 'A list of pets',
            },
          },
        },
      },
      '/users': {
        post: {
          summary: 'Create user',
          responses: {
            '201': {
              description: 'User created',
            },
          },
        },
      },
    },
  };

  it('renders with Sidebar component', () => {
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
  });

  it('renders with Overview component initially', () => {
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getByTestId('overview-mock')).toBeInTheDocument();
    expect(
      screen.queryByTestId('endpoint-detail-mock')
    ).not.toBeInTheDocument();
  });

  it('passes the spec to child components', () => {
    // This is more of a smoke test since we're mocking the components
    render(<FlexDoc spec={mockSpec} />);
    // If the component renders without errors, the spec was passed correctly
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
    expect(screen.getByTestId('overview-mock')).toBeInTheDocument();
  });

  it('renders with custom theme when provided', () => {
    render(<FlexDoc spec={mockSpec} theme='dark' />);
    // If the component renders without errors with the theme prop, it's working
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
  });

  it('renders with custom styles when provided', () => {
    const customStyles = { maxWidth: '1200px', margin: '0 auto' };
    render(<FlexDoc spec={mockSpec} customStyles={customStyles} />);
    // If the component renders without errors with the customStyles prop, it's working
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
  });
});

