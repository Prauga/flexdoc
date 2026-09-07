import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar';
import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';
import { ApiClient } from './ApiClient';
import type { OpenAPISpec } from '../types/openapi';

const spec: OpenAPISpec = { openapi: '3.1.0', info: { title: 'Test', version: '1' }, paths: { '/pets': { get: { responses: { '200': { description: 'ok' } } } } } };

it('localizes sidebar chrome', () => {
  render(<Sidebar spec={spec} onEndpointSelect={() => {}} messages={{ searchEndpoints: 'Buscar endpoints', searchEndpointsPlaceholder: 'Buscar…', apiInformation: 'Información API', endpoints: 'Operaciones' }} />);
  expect(screen.getByPlaceholderText('Buscar…')).toBeInTheDocument();
  expect(screen.getByText('Información API')).toBeInTheDocument();
  expect(screen.getByText('Operaciones')).toBeInTheDocument();
});

it('localizes runtime intelligence chrome', () => {
  render(<RuntimeIntelligencePanel open theme='light' loading={false} onClose={() => {}} messages={{ runtimeIntelligence: 'Inteligencia runtime', runtimeIntelligenceDescription: 'Rutas en vivo', implementedButUndocumented: 'No documentadas', documentedButNotObserved: 'No observadas' }} snapshot={{ framework: 'test', runtime: { name: 'node', version: '1', platform: 'x', arch: 'y' }, discoveryComplete: true, routes: [], runtimeOnly: [], documentedOnly: [], summary: { documented: 0, runtime: 0, matched: 0, runtimeOnly: 0, documentedOnly: 0 } }} />);
  expect(screen.getByText('Inteligencia runtime')).toBeInTheDocument();
  expect(screen.getByText('Rutas en vivo')).toBeInTheDocument();
  expect(screen.getByText(/No documentadas/)).toBeInTheDocument();
  expect(screen.getByText(/No observadas/)).toBeInTheDocument();
});

it('localizes the GET body advisory', () => {
  render(<ApiClient initialRequest={{ method: 'GET', url: 'https://example.test', body: '{}', bodyMode: 'raw' }} messages={{ unusualBodyAdvisory: 'Cuerpo GET inusual' }} />);
  expect(screen.getByText('Cuerpo GET inusual')).toBeInTheDocument();
});
