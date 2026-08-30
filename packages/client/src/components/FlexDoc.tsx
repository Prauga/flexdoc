import React, { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { Sidebar } from './Sidebar';
import { EndpointDetail } from './EndpointDetail';
import { Overview } from './Overview';
import '../index.css';
import { Footer } from './Footer';
import { themeVariant } from '../utils/theme';
import { OpenAPIParser } from '../utils/openapi-parser';
import { FlexDocRendererOptions, LogoOptions, ThemeConfig } from '../types/options';

export interface FlexDocProps {
  spec: OpenAPISpec;
  theme?: 'light' | 'dark';
  customStyles?: React.CSSProperties;
  options?: FlexDocRendererOptions;
}

function cssValue(value?: string | number): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function themeStyles(theme: 'light' | 'dark', config?: ThemeConfig): React.CSSProperties {
  if (!config) return {};
  const colors = config.colors || {};
  const typography = config.typography || {};
  const sidebar = config.sidebar || {};
  return {
    '--flexdoc-primary': colors.primary?.main,
    '--flexdoc-text': colors.text?.primary,
    '--flexdoc-text-muted': colors.text?.secondary,
    '--flexdoc-border': theme === 'dark' ? colors.border?.dark : colors.border?.light,
    '--flexdoc-sidebar-bg': theme === 'dark' ? sidebar.backgroundColorDark : sidebar.backgroundColor,
    '--flexdoc-sidebar-text': theme === 'dark' ? sidebar.textColorDark : sidebar.textColor,
    '--flexdoc-sidebar-active-text': theme === 'dark' ? sidebar.activeTextColorDark : sidebar.activeTextColor,
    '--flexdoc-heading-font': typography.headings?.fontFamily,
    '--flexdoc-heading-weight': typography.headings?.fontWeight,
    '--flexdoc-code-font': typography.code?.fontFamily,
    '--flexdoc-code-size': typography.code?.fontSize,
    '--flexdoc-code-line-height': typography.code?.lineHeight,
    '--flexdoc-code-color': typography.code?.color,
    '--flexdoc-code-bg': typography.code?.backgroundColor,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
  } as React.CSSProperties;
}

function endpointHash(path: string, method: string): string {
  return `${method.toLowerCase()}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function endpointFromHash(spec: OpenAPISpec, hash: string): { path: string; method: string } | null {
  const normalized = hash.replace(/^#/, '');
  if (!normalized) return null;
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of OpenAPIParser.getHttpMethods(pathItem)) {
      if (endpointHash(path, method) === normalized) return { path, method };
    }
  }
  return null;
}

function Logo({ logo }: { logo: string | LogoOptions }) {
  const config: LogoOptions = typeof logo === 'string' ? { url: logo } : logo;
  const padding = typeof config.padding === 'object'
    ? `${cssValue(config.padding.vertical) || '0'} ${cssValue(config.padding.horizontal) || '0'}`
    : config.padding;
  const image = <img src={config.url} alt={config.alt || 'API documentation logo'} style={{ maxHeight: cssValue(config.maxHeight) || '32px', maxWidth: cssValue(config.maxWidth) || '180px' }} />;
  return <div className={`flex items-center ${config.containerClass || ''}`} style={{ backgroundColor: config.backgroundColor, padding }}>
    {config.clickable === false ? image : <a href='#' aria-label='Documentation home'>{image}</a>}
  </div>;
}

export const FlexDoc: React.FC<FlexDocProps> = ({
  spec,
  theme = 'light',
  customStyles = {},
  options = {},
}: FlexDocProps) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ path: string; method: string } | null>(() =>
    typeof window === 'undefined' ? null : endpointFromHash(spec, window.location.hash)
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const themeConfig = typeof options.theme === 'object' ? options.theme : undefined;
  const mergedStyles = useMemo(() => ({ ...themeStyles(theme, themeConfig), ...customStyles }), [theme, themeConfig, customStyles]);

  useEffect(() => {
    if (!options.customCss) return;
    const element = document.createElement('style');
    element.dataset.flexdocCustomCss = 'true';
    element.textContent = options.customCss;
    document.head.appendChild(element);
    return () => element.remove();
  }, [options.customCss]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => setSelectedEndpoint(endpointFromHash(spec, window.location.hash));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [spec]);

  useEffect(() => {
    if (!mobileNavOpen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen]);

  const handleEndpointSelect = (path: string, method: string) => {
    setSelectedEndpoint({ path, method });
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') window.location.hash = endpointHash(path, method);
  };

  const footerClasses = themeVariant(theme, 'border-gray-200 bg-white text-gray-600', 'border-gray-700 bg-gray-800 text-gray-300');
  const rootClasses = theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';

  return (
    <div className={`flexdoc-root flex min-h-screen flex-col ${rootClasses}`} style={mergedStyles}>
      {!options.hideTopbar && (
        <header className={`sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b px-3 sm:px-5 ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <button className='inline-flex h-11 w-11 items-center justify-center rounded-md lg:hidden' aria-label='Open API navigation' aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu className='h-5 w-5' /></button>
          {options.logo && <Logo logo={options.logo} />}
          <div className='min-w-0 flex-1'>
            <div className='truncate font-semibold'>{spec.info.title}</div>
            {!options.hideHostname && spec.servers?.[0]?.url && <div className='truncate text-xs opacity-60'>{spec.servers[0].url}</div>}
          </div>
          {!options.hideDownloadButton && <a className='hidden rounded-md border px-3 py-2 text-sm sm:inline-flex' href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(spec, null, 2))}`} download='openapi.json'>Download spec</a>}
        </header>
      )}

      <div className='relative flex min-h-0 flex-1 overflow-hidden'>
        <aside className='hidden w-80 shrink-0 lg:block' style={{ background: 'var(--flexdoc-sidebar-bg)', color: 'var(--flexdoc-sidebar-text)' }}>
          <Sidebar spec={spec} onEndpointSelect={handleEndpointSelect} theme={theme} selectedEndpoint={selectedEndpoint || undefined} />
        </aside>

        {mobileNavOpen && <div className='fixed inset-0 z-50 lg:hidden' role='dialog' aria-modal='true' aria-label='API navigation'>
          <button aria-label='Close navigation backdrop' className='absolute inset-0 bg-black/40' onClick={() => setMobileNavOpen(false)} />
          <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col shadow-2xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className='flex h-14 items-center justify-between border-b px-4'>
              <span className='font-semibold'>API navigation</span>
              <button className='inline-flex h-11 w-11 items-center justify-center rounded-md' aria-label='Close API navigation' onClick={() => setMobileNavOpen(false)}><X className='h-5 w-5' /></button>
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto'><Sidebar spec={spec} onEndpointSelect={handleEndpointSelect} theme={theme} selectedEndpoint={selectedEndpoint || undefined} /></div>
          </aside>
        </div>}

        <main className='min-w-0 flex-1 overflow-hidden'>
          {selectedEndpoint ? (
            <EndpointDetail spec={spec} path={selectedEndpoint.path} method={selectedEndpoint.method} theme={theme} options={options} />
          ) : (
            <Overview spec={spec} onEndpointSelect={handleEndpointSelect} theme={theme} />
          )}
        </main>
      </div>
      <Footer footerClasses={footerClasses} footer={options.footer} />
    </div>
  );
};
