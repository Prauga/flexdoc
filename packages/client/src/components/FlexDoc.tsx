import React, { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { Sidebar } from './Sidebar';
import { EndpointDetail } from './EndpointDetail';
import { Overview } from './Overview';
import '../index.css';
import { Footer } from './Footer';
import { themeVariant } from '../utils/theme';
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
  return {
    '--flexdoc-primary': colors.primary?.main,
    '--flexdoc-text': colors.text?.primary,
    '--flexdoc-text-muted': colors.text?.secondary,
    '--flexdoc-border': theme === 'dark' ? colors.border?.dark : colors.border?.light,
    '--flexdoc-sidebar-bg': theme === 'dark' ? config.sidebar?.backgroundColorDark : config.sidebar?.backgroundColor,
    '--flexdoc-sidebar-text': theme === 'dark' ? config.sidebar?.textColorDark : config.sidebar?.textColor,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
  } as React.CSSProperties;
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
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ path: string; method: string } | null>(null);
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

  const handleEndpointSelect = (path: string, method: string) => {
    setSelectedEndpoint({ path, method });
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') window.location.hash = `${method.toLowerCase()}-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  };

  const footerClasses = themeVariant(theme, 'border-gray-200 bg-white text-gray-600', 'border-gray-700 bg-gray-800 text-gray-300');
  const rootClasses = theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';

  return (
    <div className={`flex min-h-screen flex-col ${rootClasses}`} style={mergedStyles}>
      {!options.hideTopbar && (
        <header className={`sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b px-3 sm:px-5 ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <button className='inline-flex h-10 w-10 items-center justify-center rounded-md lg:hidden' aria-label='Open API navigation' onClick={() => setMobileNavOpen(true)}><Menu className='h-5 w-5' /></button>
          {options.logo && <Logo logo={options.logo} />}
          <div className='min-w-0 flex-1'>
            <div className='truncate font-semibold'>{spec.info.title}</div>
            {!options.hideHostname && spec.servers?.[0]?.url && <div className='truncate text-xs opacity-60'>{spec.servers[0].url}</div>}
          </div>
          {!options.hideDownloadButton && <a className='hidden rounded-md border px-3 py-2 text-sm sm:inline-flex' href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(spec, null, 2))}`} download='openapi.json'>Download spec</a>}
        </header>
      )}

      <div className='relative flex min-h-0 flex-1 overflow-hidden'>
        <aside className='hidden w-72 shrink-0 lg:block' style={{ background: 'var(--flexdoc-sidebar-bg)', color: 'var(--flexdoc-sidebar-text)' }}>
          <Sidebar spec={spec} onEndpointSelect={handleEndpointSelect} theme={theme} selectedEndpoint={selectedEndpoint || undefined} />
        </aside>

        {mobileNavOpen && <div className='fixed inset-0 z-50 lg:hidden'>
          <button aria-label='Close navigation backdrop' className='absolute inset-0 bg-black/40' onClick={() => setMobileNavOpen(false)} />
          <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col shadow-2xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className='flex h-14 items-center justify-between border-b px-4'>
              <span className='font-semibold'>API navigation</span>
              <button className='inline-flex h-10 w-10 items-center justify-center rounded-md' aria-label='Close API navigation' onClick={() => setMobileNavOpen(false)}><X className='h-5 w-5' /></button>
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
