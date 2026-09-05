import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import { OpenAPISpec, Operation, RequestBody, Response } from '../types/openapi';
import { ExpandSection, FlexDocRendererOptions } from '../types/options';
import { resolveExpandSections } from '../utils/renderer-preferences';
import { OpenAPIParser } from '../utils/openapi-parser';
import { buildRequest, initialRequestValues, parametersFor } from '../utils/request-builder';
import { CodeSampleLanguage, generateCodeSample, languageLabel } from '../utils/code-samples';
import { CodeBlock } from './CodeBlock';
import { SchemaView } from './SchemaView';
import { TryItApiClientWorkspace } from './TryItApiClientWorkspace';

interface EndpointDetailProps {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme?: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  defaultExpandedSections?: ExpandSection[];
}

const DEFAULT_LANGUAGES: CodeSampleLanguage[] = ['curl', 'javascript', 'python', 'go', 'java'];

export const EndpointDetail: React.FC<EndpointDetailProps> = ({ spec, path, method, theme = 'light', options = {}, defaultExpandedSections }) => {
  const defaultExpanded = defaultExpandedSections ?? resolveExpandSections(options.expand, options.expand === undefined ? options.expandResponses : undefined);
  const expansionKey = `${method}:${path}:${defaultExpanded.join('|')}`;
  const [expansionState, setExpansionState] = useState<{ key: string; sections: Set<ExpandSection> }>(() => ({
    key: expansionKey,
    sections: new Set(defaultExpanded),
  }));
  const expandedSections = expansionState.key === expansionKey ? expansionState.sections : new Set(defaultExpanded);
  const [sampleLanguage, setSampleLanguage] = useState<CodeSampleLanguage>((options.codeSamples?.languages?.[0] as CodeSampleLanguage) || 'curl');
  const initialBuiltRequest = useMemo(() => buildRequest(spec, path, method, initialRequestValues(spec, path, method)), [spec, path, method]);
  const [sampleRequest, setSampleRequest] = useState(initialBuiltRequest);
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const parameters = useMemo(() => parametersFor(spec, path, method), [spec, path, method]);

  if (!operation) return <div className='p-6'>Operation not found.</div>;

  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const card = theme === 'dark' ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white';
  const surface = theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const languages = (options.codeSamples?.languages?.length ? options.codeSamples.languages : DEFAULT_LANGUAGES) as CodeSampleLanguage[];
  const security = operation.security ?? spec.security;
  const schemaOptions = { requiredPropsFirst: options.requiredPropsFirst, sortPropsAlphabetically: options.sortPropsAlphabetically };

  const toggle = (id: ExpandSection) => setExpansionState((current) => {
    const next = new Set(current.key === expansionKey ? current.sections : defaultExpanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { key: expansionKey, sections: next };
  });

  const section = (title: string, id: ExpandSection, children: React.ReactNode) => (
    <section className='mb-8' aria-labelledby={`${id}-heading`}>
      <button id={`${id}-heading`} aria-expanded={expandedSections.has(id)} onClick={() => toggle(id)} className='mb-4 flex min-h-10 w-full items-center gap-2 text-left text-base font-semibold sm:text-lg'>
        {expandedSections.has(id) ? <ChevronDown className='h-5 w-5 shrink-0' /> : <ChevronRight className='h-5 w-5 shrink-0' />}{title}
      </button>
      {expandedSections.has(id) && children}
    </section>
  );

  const requestBody = operation.requestBody
    ? OpenAPIParser.isReference(operation.requestBody)
      ? OpenAPIParser.resolveReference<RequestBody>(spec, operation.requestBody.$ref)
      : operation.requestBody
    : undefined;

  const extensionEntries = Object.entries(operation).filter(([key]) => key.startsWith('x-'));
  const methodTheme = typeof options.theme === 'object' ? options.theme.methodColors?.[method.toLowerCase()] : undefined;

  return <div className={`h-full overflow-y-auto ${surface}`}>
    <article className='mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8'>
      <header className='mb-8'>
        <div className='mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3'>
          <span className={`shrink-0 rounded border px-2.5 py-1 text-xs font-bold sm:text-sm ${OpenAPIParser.getMethodColor(method, theme)}`} style={{ background: methodTheme?.bg, borderColor: methodTheme?.border }}>{method.toUpperCase()}</span>
          <code className={`min-w-0 max-w-full overflow-x-auto rounded px-2.5 py-1 font-mono text-sm sm:text-base ${theme === 'dark' ? 'bg-gray-800 text-blue-300' : 'bg-gray-100 text-gray-900'}`}>{path}</code>
        </div>
        {operation.summary && <h1 className='mb-2 text-2xl font-bold tracking-tight sm:text-3xl'>{operation.summary}</h1>}
        {operation.description && <p className={`max-w-3xl whitespace-pre-wrap leading-relaxed ${muted}`}>{operation.description}</p>}
        <div className='mt-4 flex flex-wrap gap-3 text-sm'>
          {operation.deprecated && <span className='inline-flex items-center gap-1 text-orange-600'><AlertCircle className='h-4 w-4' />Deprecated</span>}
          {security?.length ? <span className='inline-flex items-center gap-1 text-red-600'><Lock className='h-4 w-4' />Authentication required</span> : <span className='inline-flex items-center gap-1 text-green-600'><Unlock className='h-4 w-4' />No authentication required</span>}
          {operation.operationId && <span className={muted}>operationId: <code>{operation.operationId}</code></span>}
        </div>
        {(options.showExtensions || options.showCommonExtensions) && extensionEntries.length > 0 && <div className={`mt-4 rounded-lg border p-3 text-xs ${card}`}>
          {extensionEntries.map(([key, value]) => <div key={key}><code>{key}</code>: {typeof value === 'string' ? value : JSON.stringify(value)}</div>)}
        </div>}
      </header>

      {parameters.length > 0 && section('Parameters', 'parameters', <div className='space-y-3'>
        {parameters.map((parameter) => <div key={`${parameter.in}:${parameter.name}`} className={`rounded-lg border p-4 ${card}`}>
          <div className='mb-2 flex flex-wrap items-center gap-2'>
            <code className='font-medium'>{parameter.name}</code><span className='rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700'>{parameter.in}</span>
            {parameter.required && <span className='rounded bg-red-100 px-2 py-0.5 text-xs text-red-700'>required</span>}
            {parameter.deprecated && <span className='rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700'>deprecated</span>}
          </div>
          {parameter.description && <p className={`mb-3 text-sm ${muted}`}>{parameter.description}</p>}
          {parameter.schema && <SchemaView spec={spec} schema={parameter.schema} theme={theme} required={parameter.required} {...schemaOptions} />}
        </div>)}
      </div>)}

      {requestBody && section('Request Body', 'requestBody', <div className='space-y-4'>
        {requestBody.description && <p className={muted}>{requestBody.description}</p>}
        {Object.entries(requestBody.content || {}).map(([mediaType, media]: [string, any]) => <div key={mediaType} className={`rounded-lg border p-4 ${card}`}>
          <div className='mb-3 flex flex-wrap items-center gap-2'><code className='rounded bg-gray-100 px-2 py-1 text-xs text-gray-700'>{mediaType}</code>{requestBody.required && <span className='rounded bg-red-100 px-2 py-0.5 text-xs text-red-700'>required</span>}</div>
          {media.schema && <SchemaView spec={spec} schema={media.schema} theme={theme} {...schemaOptions} />}
          {media.example !== undefined && <div className='mt-3'><CodeBlock code={JSON.stringify(media.example, null, 2)} language='json' title='Example payload' theme={theme} wrap /></div>}
        </div>)}
      </div>)}

      {section('Responses', 'responses', <div className='space-y-4'>
        {Object.entries(operation.responses || {}).map(([status, raw]: [string, any]) => {
          const response = OpenAPIParser.isReference(raw) ? OpenAPIParser.resolveReference<Response>(spec, raw.$ref) : raw;
          return <div key={status} className={`rounded-lg border p-4 ${card}`}>
            <div className='mb-3 flex flex-wrap items-center gap-2'><span className='rounded border px-2.5 py-1 text-sm font-bold'>{status}</span><span className={`text-sm ${muted}`}>{response.description}</span></div>
            {response.headers && options.showRequestHeaders && <div className='mb-3 text-sm'><span className='font-medium'>Headers:</span> {Object.keys(response.headers).join(', ')}</div>}
            {response.content && Object.entries(response.content).map(([mediaType, media]: [string, any]) => <div key={mediaType} className='mt-3'>
              <code className='text-xs opacity-70'>{mediaType}</code>
              {media.schema && <div className='mt-2'><SchemaView spec={spec} schema={media.schema} theme={theme} {...schemaOptions} /></div>}
              {media.example !== undefined && <div className='mt-3'><CodeBlock code={JSON.stringify(media.example, null, 2)} language='json' title='Example response' theme={theme} wrap /></div>}
              {media.examples && Object.values(media.examples)[options.payloadSampleIdx || 0] && <div className='mt-3'><CodeBlock code={JSON.stringify((Object.values(media.examples)[options.payloadSampleIdx || 0] as any).value ?? Object.values(media.examples)[options.payloadSampleIdx || 0], null, 2)} language='json' title='Example response' theme={theme} wrap /></div>}
            </div>)}
          </div>;
        })}
      </div>)}

      {options.tryIt?.enabled !== false && section('Try It', 'tryIt', <TryItApiClientWorkspace
        key={`${method}:${path}:${options.tryIt?.defaultServer || ''}`}
        spec={spec}
        path={path}
        method={method}
        theme={theme}
        options={options}
        onRequestChange={setSampleRequest}
      />)}

      {options.codeSamples?.enabled !== false && section('Code Examples', 'codeSamples', <div className='min-w-0'>
        <div className='mb-3 flex max-w-full gap-1 overflow-x-auto pb-1' role='tablist' aria-label='Code example language'>
          {languages.map((language) => <button key={language} role='tab' aria-selected={sampleLanguage === language} onClick={() => setSampleLanguage(language)} className={`shrink-0 rounded-md px-3 py-2 text-sm ${sampleLanguage === language ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{languageLabel(language)}</button>)}
        </div>
        <CodeBlock code={generateCodeSample(sampleRequest, sampleLanguage)} language={sampleLanguage === 'curl' ? 'bash' : sampleLanguage} title={languageLabel(sampleLanguage)} theme={theme} wrap={Boolean(typeof options.theme === 'object' && options.theme.typography?.code?.wrap)} />
      </div>)}

      {operation.externalDocs && <p className='pb-4 text-sm'><a className='text-blue-600 underline' href={operation.externalDocs.url} target='_blank' rel='noopener noreferrer'>{operation.externalDocs.description || 'External documentation'}</a></p>}
    </article>
  </div>;
};
