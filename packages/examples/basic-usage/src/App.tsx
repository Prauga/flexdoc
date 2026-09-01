import { FlexDoc } from '@prauga/flexdoc-client';
import type { FlexDocRendererOptions, OpenAPISpec } from '@prauga/flexdoc-client';
import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import showcaseSpec from '../../../../examples/showcase-openapi.json';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32"%3E%3Crect width="96" height="32" rx="8" fill="%23111827"/%3E%3Ctext x="12" y="21" fill="white" font-family="Arial,sans-serif" font-size="14" font-weight="700"%3EFlexDoc%3C/text%3E%3C/svg%3E';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const options = useMemo<FlexDocRendererOptions>(() => ({
    title: 'FlexDoc 2.2 feature showcase',
    description: 'One runnable example for the complete renderer, Try It and API Client workflow.',
    version: '2.2.0',
    tagGroups: [
      { name: 'Core API', tags: ['Pets', 'Search'] },
      { name: 'Request bodies & auth', tags: ['Forms', 'Admin'] },
    ],
    theme: {
      colors: {
        primary: { main: '#7c3aed' },
        text: { primary: darkMode ? '#f9fafb' : '#111827', secondary: darkMode ? '#d1d5db' : '#4b5563' },
        border: { light: '#e5e7eb', dark: '#374151' },
      },
      typography: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        headings: { fontWeight: '700' },
        code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px', wrap: true },
      },
      sidebar: {
        backgroundColor: '#fafafa',
        backgroundColorDark: '#111827',
        textColor: '#374151',
        textColorDark: '#d1d5db',
        activeTextColor: '#6d28d9',
        activeTextColorDark: '#c4b5fd',
      },
    },
    logo: { url: logo, alt: 'FlexDoc', maxHeight: 32, clickable: false },
    customCss: '.flexdoc-root { --showcase-accent: #7c3aed; }',
    hideDownloadButton: false,
    hideTopbar: false,
    expandResponses: '200,201',
    defaultModelsExpandDepth: 2,
    showExtensions: true,
    showCommonExtensions: true,
    hideHostname: false,
    nativeScrollbars: true,
    pathInMiddlePanel: true,
    requiredPropsFirst: true,
    sortPropsAlphabetically: true,
    showRequestHeaders: true,
    noAutoAuth: false,
    lazyRendering: false,
    scrollYOffset: 64,
    suppressWarnings: false,
    payloadSampleIdx: 0,
    tryIt: {
      enabled: true,
      defaultServer: 'http://localhost:3000',
      credentials: 'same-origin',
      requestInterceptor: (request) => ({
        ...request,
        headers: { ...request.headers, 'X-FlexDoc-Example': 'react-showcase' },
      }),
    },
    codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
    footer: {
      copyright: 'Prauga FlexDoc 2.2 showcase',
      link: [
        { text: 'Repository', url: 'https://github.com/prauga/flexdoc' },
        { text: 'AGPL-3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
      ],
    },
  }), [darkMode]);

  return (
    <div className='min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200'>
      <div className='flex justify-end p-3'>
        <button
          onClick={() => setDarkMode((value) => !value)}
          className='p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200'
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <FlexDoc
        spec={showcaseSpec as OpenAPISpec}
        theme={darkMode ? 'dark' : 'light'}
        options={options}
      />
    </div>
  );
}

export default App;
