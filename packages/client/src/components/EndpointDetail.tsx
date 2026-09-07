import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronRight, Link2, Lock, Unlock } from 'lucide-react';
import { OpenAPISpec, Operation, RequestBody, Response } from '../types/openapi';
import { ExpandSection, FlexDocRendererOptions, FlexDocRuntimeIntelligenceSnapshot } from '../types/options';
import { resolveExpandSections } from '../utils/renderer-preferences';
import { OpenAPIParser } from '../utils/openapi-parser';
import { buildRequest, initialRequestValues, parametersFor } from '../utils/request-builder';
import { CodeSampleLanguage, generateCodeSample, languageLabel } from '../utils/code-samples';
import type { ApiClientRequestTab, ApiClientScriptTab } from './ApiClient';
import { CodeBlock } from './CodeBlock';
import { SchemaView } from './SchemaView';
import { TryItApiClientWorkspace } from './TryItApiClientWorkspace';
import type { TryItApiClientHandoff } from './TryItApiClientWorkspace';
import { operationHashId } from '../utils/operation-id';

interface EndpointDetailProps {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme?: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  defaultExpandedSections?: ExpandSection[];
  runtimeSnapshot?: FlexDocRuntimeIntelligenceSnapshot;
  onOpenInApiClient?: (session: TryItApiClientHandoff) => void;
}

interface ViewerDeepLinkState {
  tryIt: boolean;
  requestTab?: ApiClientRequestTab;
  scriptTab?: ApiClientScriptTab;
}

const DEFAULT_LANGUAGES: CodeSampleLanguage[] = ['curl', 'javascript', 'python', 'go', 'java'];


function readViewerDeepLinkState(): ViewerDeepLinkState {
  if (typeof window === 'undefined') return { tryIt: false };
  const query = new URLSearchParams(window.location.search);
  const requestTab = query.get('tab');
  const scriptTab = query.get('script');
  return {
    tryIt: query.get('tryIt') === '1',
    requestTab: requestTab && /^(params|headers|authorization|body|scripts)$/.test(requestTab) ? requestTab as ApiClientRequestTab : undefined,
    scriptTab: scriptTab && /^(pre-request|tests)$/.test(scriptTab) ? scriptTab as ApiClientScriptTab : undefined,
  };
}

function replaceViewerState(name: string, value?: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export const EndpointDetail: React.FC<EndpointDetailProps> = ({ spec, path, method, theme = 'light', options = {}, defaultExpandedSections, runtimeSnapshot, onOpenInApiClient }) => {
  const deepLink = readViewerDeepLinkState();
  const configuredExpanded = defaultExpandedSections ?? resolveExpandSections(options.expand, options.expand === undefined ? options.expandResponses : undefined);
  const defaultExpanded = deepLink.tryIt && !configuredExpanded.includes('tryIt') ? [...configuredExpanded, 'tryIt' as ExpandSection] : configuredExpanded;
  const expansionKey = `${method}:${path}:${defaultExpanded.join('|')}`;
  const [expansionState, setExpansionState] = useState<{ key: string; sections: Set<ExpandSection> }>(() => ({
    key: expansionKey,
    sections: new Set(defaultExpanded),
  }));
  const expandedSections = expansionState.key === expansionKey ? expansionState.sections : new Set(defaultExpanded);
  const [sampleLanguage, setSampleLanguage] = useState<CodeSampleLanguage>((options.codeSamples?.languages?.[0] as CodeSampleLanguage) || 'curl');
  const [copiedLink, setCopiedLink] = useState(false);
  const codeTabsId = useId().replace(/:/g, '');
  const codeTabRefs = useRef<Partial<Record<CodeSampleLanguage, HTMLButtonElement | null>>>({});
  const initialBuiltRequest = useMemo(() => buildRequest(spec, path, method, initialRequestValues(spec, path, method)), [spec, path, method]);
  const [sampleRequest, setSampleRequest] = useState(initialBuiltRequest);
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const parameters = useMemo(() => parametersFor(spec, path, method), [spec, path, method]);
  const messages = options.messages;

  useEffect(() => {
    if (!deepLink.tryIt || typeof document === 'undefined') return;
    requestAnimationFrame(() => document.getElementById('tryIt-heading')?.scrollIntoView({ block: 'start' }));
  }, [deepLink.tryIt, method, path]);

  if (!operation) return <div className='p-6'>Operation not found.</div>;

  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const card = theme === 'dark' ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white';
  const surface = theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const languages = (options.codeSamples?.languages?.length ? options.codeSamples.languages : DEFAULT_LANGUAGES) as CodeSampleLanguage[];
  const security = operation.security ?? spec.security;
  const schemaOptions = { requiredPropsFirst: options.requiredPropsFirst, sortPropsAlphabetically: options.sortPropsAlphabetically };
  const infoChip = theme === 'dark' ? 'bg-blue-950/60 text-blue-200' : 'bg-blue-100 text-blue-700';
  const requiredChip = theme === 'dark' ? 'bg-red-950/60 text-red-200' : 'bg-red-100 text-red-700';
  const deprecatedChip = theme === 'dark' ? 'bg-orange-950/60 text-orange-200' : 'bg-orange-100 text-orange-700';
  const mediaChip = theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700';
  const codeTabId = (language: CodeSampleLanguage) => `${codeTabsId}-code-tab-${language}`;
  const codePanelId = `${codeTabsId}-code-panel`;

  const toggle = (id: ExpandSection) => {
    const opening = !expandedSections.has(id);
    setExpansionState((current) => {
      const next = new Set(current.key === expansionKey ? current.sections : defaultExpanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { key: expansionKey, sections: next };
    });
    if (id === 'tryIt') replaceViewerState('tryIt', opening ? '1' : undefined);
  };

  const section = (title: string, id: ExpandSection, children: React.ReactNode) => (
    <section className='mb-8' aria-labelledby={`${id}-heading`}>
      <button type='button' id={`${id}-heading`} aria-expanded={expandedSections.has(id)} onClick={() => toggle(id)} className='mb-4 flex min-h-10 w-full items-center gap-2 text-left text-base font-semibold sm:text-lg'>
        {expandedSections.has(id) ? <ChevronDown className='h-5 w-5 shrink-0' /> : <ChevronRight className='h-5 w-5 shrink-0' />}{title}
      </button>
      {expandedSections.has(id) && children}
    </section>
  );

  const selectCodeLanguage = (language: CodeSampleLanguage) => {
    setSampleLanguage(language);
    codeTabRefs.current[language]?.focus();
  };

  const handleCodeTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: CodeSampleLanguage) => {
    if (!/^(ArrowLeft|ArrowRight|Home|End)$/.test(event.key)) return;
    event.preventDefault();
    const index = languages.indexOf(current);
    const next = event.key === 'Home' ? languages[0]
      : event.key === 'End' ? languages[languages.length - 1]
        : event.key === 'ArrowRight' ? languages[(index + 1) % languages.length]
          : languages[(index - 1 + languages.length) % languages.length];
    selectCodeLanguage(next);
  };

  const copyEndpointLink = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) return;
    const url = new URL(window.location.href);
    url.hash = operationHashId(path, method);
    await navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1400);
  };

  const requestBody = operation.requestBody
    ? OpenAPIParser.isReference(operation.requestBody)
      ? OpenAPIParser.resolveReference<RequestBody>(spec, operation.requestBody.$ref)
      : operation.requestBody
    : undefined;

  const extensionEntries = Object.entries(operation).filter(([key]) => key.startsWith('x-'));
  const methodTheme = typeof options.theme === 'object' ? options.theme.methodColors?.[method.toLowerCase()] : undefined;
  const runtimeObserved = runtimeSnapshot?.routes.some((route) => route.method === method.toUpperCase() && route.path === path);

  return <div lang={options.locale} className={`min-h-full ${surface}`}>
    <article className='mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8'>
      <header className='mb-8'>
        <div className='mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3'>
          <span className={`shrink-0 rounded border px-2.5 py-1 text-xs font-bold sm:text-sm ${OpenAPIParser.getMethodColor(method, theme)}`} style={{ background: methodTheme?.bg, borderColor: methodTheme?.border }}>{method.toUpperCase()}</span>
          <code className={`min-w-0 max-w-full overflow-x-auto rounded px-2.5 py-1 font-mono text-sm sm:text-base ${theme === 'dark' ? 'bg-gray-800 text-blue-300' : 'bg-gray-100 text-gray-900'}`}>{path}</code>
          <button type='button' className='inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs' aria-label='Copy endpoint link' onClick={() => { void copyEndpointLink(); }}>{copiedLink ? <Check className='h-3.5 w-3.5' /> : <Link2 className='h-3.5 w-3.5' />}{copiedLink ? 'Copied' : 'Copy link'}</button>
        </div>
        {operation.summary && <h1 className='mb-2 text-2xl font-bold tracking-tight sm:text-3xl'>{operation.summary}</h1>}
        {operation.description && <p className={`max-w-3xl whitespace-pre-wrap leading-relaxed ${muted}`}>{operation.description}</p>}
        <div className='mt-4 flex flex-wrap gap-3 text-sm'>
          {operation.deprecated && <span className={theme === 'dark' ? 'inline-flex items-center gap-1 text-orange-300' : 'inline-flex items-center gap-1 text-orange-600'}><AlertCircle className='h-4 w-4' />Deprecated</span>}
          {security?.length ? <span className={theme === 'dark' ? 'inline-flex items-center gap-1 text-red-300' : 'inline-flex items-center gap-1 text-red-600'}><Lock className='h-4 w-4' />Authentication required</span> : <span className={theme === 'dark' ? 'inline-flex items-center gap-1 text-green-300' : 'inline-flex items-center gap-1 text-green-600'}><Unlock className='h-4 w-4' />No authentication required</span>}
          {runtimeSnapshot && (runtimeObserved
            ? <span className={theme === 'dark' ? 'text-green-300' : 'text-green-600'}>Observed at runtime</span>
            : <span className={runtimeSnapshot.discoveryComplete ? (theme === 'dark' ? 'text-amber-300' : 'text-amber-600') : muted}>{runtimeSnapshot.discoveryComplete ? 'Not found at runtime' : 'Not observed in partial runtime discovery'}</span>)}
          {operation.operationId && <span className={muted}>operationId: <code>{operation.operationId}</code></span>}
        </div>
        {(options.showExtensions || options.showCommonExtensions) && extensionEntries.length > 0 && <div className={`mt-4 rounded-lg border p-3 text-xs ${card}`}>
          {extensionEntries.map(([key, value]) => <div key={key}><code>{key}</code>: {typeof value === 'string' ? value : JSON.stringify(value)}</div>)}
        </div>}
      </header>

      {parameters.length > 0 && section(messages?.parameters || 'Parameters', 'parameters', <div className='space-y-3'>
        {parameters.map((parameter) => <div key={`${parameter.in}:${parameter.name}`} className={`rounded-lg border p-4 ${card}`}>
          <div className='mb-2 flex flex-wrap items-center gap-2'>
            <code className='font-medium'>{parameter.name}</code><span className={`rounded px-2 py-0.5 text-xs ${infoChip}`}>{parameter.in}</span>
            {parameter.required && <span className={`rounded px-2 py-0.5 text-xs ${requiredChip}`}>required</span>}
            {parameter.deprecated && <span className={`rounded px-2 py-0.5 text-xs ${deprecatedChip}`}>deprecated</span>}
          </div>
          {parameter.description && <p className={`mb-3 text-sm ${muted}`}>{parameter.description}</p>}
          {parameter.schema && <SchemaView spec={spec} schema={parameter.schema} theme={theme} required={parameter.required} {...schemaOptions} />}
        </div>)}
      </div>)}

      {requestBody && section(messages?.requestBody || 'Request Body', 'requestBody', <div className='space-y-4'>
        {requestBody.description && <p className={muted}>{requestBody.description}</p>}
        {Object.entries(requestBody.content || {}).map(([mediaType, media]: [string, any]) => <div key={mediaType} className={`rounded-lg border p-4 ${card}`}>
          <div className='mb-3 flex flex-wrap items-center gap-2'><code className={`rounded px-2 py-1 text-xs ${mediaChip}`}>{mediaType}</code>{requestBody.required && <span className={`rounded px-2 py-0.5 text-xs ${requiredChip}`}>required</span>}</div>
          {media.schema && <SchemaView spec={spec} schema={media.schema} theme={theme} {...schemaOptions} />}
          {media.example !== undefined && <div className='mt-3'><CodeBlock code={JSON.stringify(media.example, null, 2)} language='json' title='Example payload' theme={theme} wrap /></div>}
        </div>)}
      </div>)}

      {section(messages?.responses || 'Responses', 'responses', <div className='space-y-4'>
        {Object.entries(operation.responses || {}).map(([status, raw]: [string, any]) => {
          const response = OpenAPIParser.isReference(raw) ? OpenAPIParser.resolveReference<Response>(spec, raw.$ref) : raw;
          return <div key={status} className={`rounded-lg border p-4 ${card}`}>
            <div className='mb-3 flex flex-wrap items-center gap-2'><span className='rounded border px-2.5 py-1 text-sm font-bold'>{status}</span><span className={`text-sm ${muted}`}>{response.description}</span></div>
            {response.headers && options.showRequestHeaders && <div className='mb-3 text-sm'><span className='font-medium'>Headers:</span> {Object.keys(response.headers).join(', ')}</div>}
            {response.content && Object.entries(response.content).map(([mediaType, media]: [string, any]) => {
              const example = media.examples && Object.values(media.examples)[options.payloadSampleIdx || 0] as any;
              return <div key={mediaType} className='mt-3'>
                <code className={`rounded px-1.5 py-0.5 text-xs ${mediaChip}`}>{mediaType}</code>
                {media.schema && <div className='mt-2'><SchemaView spec={spec} schema={media.schema} theme={theme} {...schemaOptions} /></div>}
                {media.example !== undefined && <div className='mt-3'><CodeBlock code={JSON.stringify(media.example, null, 2)} language='json' title='Example response' theme={theme} wrap /></div>}
                {example && <div className='mt-3'><CodeBlock code={JSON.stringify(example.value ?? example, null, 2)} language='json' title='Example response' theme={theme} wrap /></div>}
              </div>;
            })}
          </div>;
        })}
      </div>)}

      {options.tryIt?.enabled !== false && section(messages?.tryIt || 'Try It', 'tryIt', <TryItApiClientWorkspace
        key={`${method}:${path}:${options.tryIt?.defaultServer || ''}`}
        spec={spec}
        path={path}
        method={method}
        theme={theme}
        options={options}
        initialRequestTab={deepLink.requestTab}
        initialScriptTab={deepLink.scriptTab}
        onRequestChange={setSampleRequest}
        onOpenInApiClient={onOpenInApiClient}
      />)}

      {options.codeSamples?.enabled !== false && section(messages?.codeExamples || 'Code Examples', 'codeSamples', <div className='min-w-0'>
        <div className='mb-3 flex max-w-full gap-1 overflow-x-auto pb-1' role='tablist' aria-label='Code example language'>
          {languages.map((language) => <button
            ref={(node) => { codeTabRefs.current[language] = node; }}
            id={codeTabId(language)}
            key={language}
            type='button'
            role='tab'
            aria-controls={codePanelId}
            aria-selected={sampleLanguage === language}
            tabIndex={sampleLanguage === language ? 0 : -1}
            onClick={() => selectCodeLanguage(language)}
            onKeyDown={(event) => handleCodeTabKeyDown(event, language)}
            className={`shrink-0 rounded-md px-3 py-2 text-sm ${sampleLanguage === language ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
          >{languageLabel(language)}</button>)}
        </div>
        <div role='tabpanel' id={codePanelId} aria-labelledby={codeTabId(sampleLanguage)}>
          <CodeBlock code={generateCodeSample(sampleRequest, sampleLanguage)} language={sampleLanguage === 'curl' ? 'bash' : sampleLanguage} title={languageLabel(sampleLanguage)} theme={theme} wrap={Boolean(typeof options.theme === 'object' && options.theme.typography?.code?.wrap)} />
        </div>
      </div>)}

      {operation.externalDocs && <p className='pb-4 text-sm'><a className='text-blue-600 underline' href={operation.externalDocs.url} target='_blank' rel='noopener noreferrer'>{operation.externalDocs.description || 'External documentation'}</a></p>}
    </article>
  </div>;
};
