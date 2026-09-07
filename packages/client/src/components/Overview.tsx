import React from 'react';
import { ExternalLink, FileText, Server, Shield, Tag } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';

interface OverviewProps {
  spec: OpenAPISpec;
  onEndpointSelect: (path: string, method: string) => void;
  theme?: 'light' | 'dark';
}

interface EndpointHighlight {
  path: string;
  method: string;
  operation: any;
  score: number;
  order: number;
}

function explicitPriority(operation: any): number {
  const raw = operation?.['x-flexdoc-priority'] ?? operation?.['x-flexdoc-weight'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function endpointScore(operation: any, method: string): number {
  let score = explicitPriority(operation) * 1000;
  if (operation?.['x-flexdoc-highlight'] === true) score += 100_000;
  if (!operation?.deprecated) score += 100;
  if (operation?.summary) score += 40;
  if (operation?.description) score += 20;
  if (operation?.operationId) score += 10;
  if (Array.isArray(operation?.tags) && operation.tags.length > 0) score += 5;
  if (method.toLowerCase() === 'get') score += 3;
  else if (method.toLowerCase() === 'post') score += 2;
  return score;
}

function endpointHighlights(spec: OpenAPISpec): EndpointHighlight[] {
  let order = 0;
  const endpoints: EndpointHighlight[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of OpenAPIParser.getHttpMethods(pathItem)) {
      const operation = pathItem[method as keyof typeof pathItem] as any;
      endpoints.push({ path, method, operation, score: endpointScore(operation, method), order: order++ });
    }
  }
  return endpoints.sort((left, right) => right.score - left.score || left.order - right.order).slice(0, 6);
}

export const Overview: React.FC<OverviewProps> = ({ spec, onEndpointSelect, theme = 'light' }) => {
  const dark = theme === 'dark';
  const cardClasses = dark ? 'border-gray-700 bg-gray-800 text-white shadow-lg' : 'border-gray-200 bg-white text-gray-900 shadow-sm';
  const textMuted = dark ? 'text-gray-300' : 'text-gray-600';
  const hoverClasses = dark ? 'hover:border-gray-600 hover:bg-gray-700' : 'hover:border-blue-300 hover:bg-blue-50';

  const endpointStats = Object.values(spec.paths).reduce((acc, pathItem) => {
    for (const method of OpenAPIParser.getHttpMethods(pathItem)) {
      acc[method] = (acc[method] || 0) + 1;
      acc.total += 1;
    }
    return acc;
  }, { total: 0 } as Record<string, number>);
  const highlights = endpointHighlights(spec);

  const stats = [
    { icon: FileText, title: 'Total endpoints', value: endpointStats.total, surface: dark ? 'bg-blue-900' : 'bg-blue-100', iconClass: dark ? 'text-blue-300' : 'text-blue-600' },
    { icon: Server, title: 'Servers', value: spec.servers?.length || 0, surface: dark ? 'bg-green-900' : 'bg-green-100', iconClass: dark ? 'text-green-300' : 'text-green-600' },
    { icon: Tag, title: 'Tags', value: spec.tags?.length || 0, surface: dark ? 'bg-purple-900' : 'bg-purple-100', iconClass: dark ? 'text-purple-300' : 'text-purple-600' },
    { icon: Shield, title: 'Security schemes', value: spec.components?.securitySchemes ? Object.keys(spec.components.securitySchemes).length : 0, surface: dark ? 'bg-orange-900' : 'bg-orange-100', iconClass: dark ? 'text-orange-300' : 'text-orange-600' },
  ];

  return <div className={`flex-1 overflow-y-auto ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
    <div className='p-4 md:p-8'>
      <header className='mb-8'>
        <div className='mb-4 flex items-center gap-4'>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${dark ? 'bg-blue-700' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}><FileText className='h-6 w-6 text-white' /></div>
          <div className='min-w-0'>
            <h1 className={`truncate text-2xl font-bold md:text-3xl ${dark ? 'text-white' : 'text-gray-900'}`}>{spec.info.title}</h1>
            <p className={textMuted}>Version {spec.info.version}</p>
          </div>
        </div>
        {spec.info.description && <p className={`max-w-4xl text-lg leading-relaxed ${textMuted}`}>{spec.info.description}</p>}
      </header>

      <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {stats.map(({ icon: Icon, title, value, surface, iconClass }) => <div key={title} className={`rounded-xl border p-4 ${cardClasses}`}>
          <div className='flex items-center gap-3'>
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${surface}`}><Icon className={`h-5 w-5 ${iconClass}`} /></div>
            <div><p className={`text-sm font-medium ${textMuted}`}>{title}</p><p className='text-xl font-bold'>{value}</p></div>
          </div>
        </div>)}
      </div>

      <section className={`mb-8 rounded-xl border p-4 md:p-6 ${cardClasses}`} aria-labelledby='method-distribution-heading'>
        <h2 id='method-distribution-heading' className='mb-4 text-lg font-semibold md:text-xl'>HTTP method distribution</h2>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6'>
          {['get', 'post', 'put', 'delete', 'patch', 'options'].map((method) => <div key={method} className='text-center'>
            <div className={`mx-auto mb-2 flex items-center justify-center rounded-lg px-3 py-1.5 ${OpenAPIParser.getMethodColor(method, theme)}`}><span className='text-sm font-medium'>{method.toUpperCase()}</span></div>
            <p className='font-bold'>{endpointStats[method] || 0}</p>
          </div>)}
        </div>
      </section>

      <section className={`mb-8 rounded-xl border p-4 md:p-6 ${cardClasses}`} aria-labelledby='endpoint-highlights-heading'>
        <div className='mb-4'>
          <h2 id='endpoint-highlights-heading' className='text-lg font-semibold md:text-xl'>Endpoint highlights</h2>
          <p className={`mt-1 text-xs ${textMuted}`}>Prioritized by explicit FlexDoc metadata when supplied, then by documentation completeness. This is not usage analytics.</p>
        </div>
        <div className='space-y-3'>
          {highlights.map(({ path, method, operation }) => <button key={`${method}-${path}`} type='button' onClick={() => onEndpointSelect(path, method)} className={`w-full rounded-lg border p-3 text-left transition-colors ${hoverClasses} ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='flex items-center gap-3'>
              <span className={`rounded border px-2 py-1 text-xs font-bold ${OpenAPIParser.getMethodColor(method, theme)}`}>{method.toUpperCase()}</span>
              <code className={`break-all font-mono text-sm ${dark ? 'text-blue-300' : 'text-blue-600'}`}>{path}</code>
            </div>
            {operation?.summary && <p className={`ml-14 mt-2 text-sm ${textMuted}`}>{operation.summary}</p>}
          </button>)}
          {highlights.length === 0 && <p className={`py-4 text-sm ${textMuted}`}>No operations are defined in this specification.</p>}
        </div>
      </section>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {(spec.info.contact || spec.info.license) && <section className={`rounded-xl border p-4 md:p-6 ${cardClasses}`} aria-labelledby='api-information-heading'>
          <h2 id='api-information-heading' className='mb-4 text-lg font-semibold md:text-xl'>Information</h2>
          <div className='space-y-4'>
            {spec.info.contact && <div>
              <h3 className='mb-2 font-medium'>Contact</h3>
              {spec.info.contact.name && <p className={`text-sm ${textMuted}`}>{spec.info.contact.name}</p>}
              {spec.info.contact.email && <a className={`block text-sm underline ${dark ? 'text-blue-300' : 'text-blue-600'}`} href={`mailto:${spec.info.contact.email}`}>{spec.info.contact.email}</a>}
              {spec.info.contact.url && <a href={spec.info.contact.url} target='_blank' rel='noopener noreferrer' className={`inline-flex items-center gap-1 text-sm ${dark ? 'text-blue-300' : 'text-blue-600'}`}>Website <ExternalLink className='h-3 w-3' /></a>}
            </div>}
            {spec.info.license && <div>
              <h3 className='mb-2 font-medium'>License</h3>
              {spec.info.license.url ? <a href={spec.info.license.url} target='_blank' rel='noopener noreferrer' className={`inline-flex items-center gap-1 text-sm ${dark ? 'text-blue-300' : 'text-blue-600'}`}>{spec.info.license.name}<ExternalLink className='h-3 w-3' /></a> : <p className={`text-sm ${textMuted}`}>{spec.info.license.name}</p>}
            </div>}
          </div>
        </section>}

        {spec.servers && spec.servers.length > 0 && <section className={`rounded-xl border p-4 md:p-6 ${cardClasses}`} aria-labelledby='api-servers-heading'>
          <h2 id='api-servers-heading' className='mb-4 text-lg font-semibold md:text-xl'>Servers</h2>
          <div className='space-y-3'>
            {spec.servers.map((server, index) => <div key={`${server.url}:${index}`} className={`rounded-lg p-3 ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <code className={`break-all font-mono text-sm ${dark ? 'text-blue-300' : 'text-blue-600'}`}>{server.url}</code>
              {server.description && <p className={`mt-1 text-sm ${textMuted}`}>{server.description}</p>}
            </div>)}
          </div>
        </section>}
      </div>
    </div>
  </div>;
};
