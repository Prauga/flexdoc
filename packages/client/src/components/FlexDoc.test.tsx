import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlexDoc } from './FlexDoc';
import { OpenAPISpec } from '../types/openapi';

jest.mock('./Sidebar', () => ({ Sidebar: () => <div data-testid='sidebar-mock'>Sidebar Mock</div> }));
jest.mock('./EndpointDetail', () => ({ EndpointDetail: () => <div data-testid='endpoint-detail-mock'>EndpointDetail Mock</div> }));
jest.mock('./Overview', () => ({ Overview: () => <div data-testid='overview-mock'>Overview Mock</div> }));

const mockSpec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/pets': { get: { summary: 'List all pets', responses: { '200': { description: 'A list of pets' } } } },
    '/users': { post: { summary: 'Create user', responses: { '201': { description: 'User created' } } } },
  },
};

describe('FlexDoc', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.body.style.overflow = '';
  });

  it('renders the documentation shell and navigation', () => {
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getAllByTestId('sidebar-mock').length).toBeGreaterThan(0);
    expect(screen.getByText('Test API')).toBeInTheDocument();
  });

  it('exposes an accessible mobile navigation trigger with touch-sized styling', () => {
    render(<FlexDoc spec={mockSpec} />);
    const trigger = screen.getByRole('button', { name: 'Open API navigation' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.className).toContain('h-11');
    expect(trigger.className).toContain('w-11');
    expect(trigger.className).toContain('lg:hidden');
  });

  it('supports dark mode and custom styles', () => {
    const { container } = render(<FlexDoc spec={mockSpec} theme='dark' customStyles={{ maxWidth: '1200px' }} />);
    expect(screen.getByText('Test API')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ maxWidth: '1200px' });
  });

  it('honors topbar, hostname and download options', () => {
    const { rerender } = render(<FlexDoc spec={mockSpec} options={{ hideHostname: true, hideDownloadButton: true }} />);
    expect(screen.queryByText('https://api.example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Download spec')).not.toBeInTheDocument();
    rerender(<FlexDoc spec={mockSpec} options={{ hideTopbar: true }} />);
    expect(screen.queryByLabelText('Open API navigation')).not.toBeInTheDocument();
  });

  it('renders a configured logo and footer', () => {
    render(<FlexDoc spec={mockSpec} options={{ logo: { url: '/logo.svg', alt: 'Acme docs' }, footer: { copyright: '© Acme', link: [{ text: 'Support', url: 'https://example.com' }] } }} />);
    expect(screen.getByAltText('Acme docs')).toBeInTheDocument();
    expect(screen.getByText('© Acme')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
