import React, { useState } from 'react';
import {
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Tag,
  Server,
} from 'lucide-react';
import { OpenAPIParser } from '../utils/openapi-parser';
import { OpenAPISpec } from '../types/openapi';

interface SidebarProps {
  spec: OpenAPISpec;
  onEndpointSelect: (path: string, method: string) => void;
  selectedEndpoint?: { path: string; method: string };
  theme?: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  spec,
  onEndpointSelect,
  selectedEndpoint = null,
  theme = 'light',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['default']));

  const sidebarClasses = theme === 'dark'
    ? 'bg-gray-900 border-r border-gray-800 text-white'
    : 'bg-white border-r border-gray-200 text-gray-700';
  const searchInputClasses = theme === 'dark'
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 focus:ring-1'
    : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 focus:ring-1';
  const sectionHeaderClasses = theme === 'dark' ? 'text-gray-300' : 'text-gray-500';
  const cardClasses = theme === 'dark'
    ? 'bg-gray-800/50 border-gray-700 text-white'
    : 'bg-gray-50 border-gray-100 text-gray-700';

  const getMethodColor = (method: string) => {
    const base = 'text-xs font-bold px-2 py-0.5 rounded border';
    const colors = {
      dark: {
        get: 'bg-blue-900/30 border-blue-700 text-blue-200', post: 'bg-green-900/30 border-green-700 text-green-200',
        put: 'bg-yellow-900/30 border-yellow-700 text-yellow-200', patch: 'bg-purple-900/30 border-purple-700 text-purple-200',
        delete: 'bg-red-900/30 border-red-700 text-red-200', default: 'bg-gray-800/50 border-gray-700 text-gray-200',
      },
      light: {
        get: 'bg-blue-50 border-blue-200 text-blue-700', post: 'bg-green-50 border-green-200 text-green-700',
        put: 'bg-yellow-50 border-yellow-200 text-yellow-700', patch: 'bg-purple-50 border-purple-200 text-purple-700',
        delete: 'bg-red-50 border-red-200 text-red-700', default: 'bg-gray-100 border-gray-200 text-gray-600',
      },
    };
    const themeColors = theme === 'dark' ? colors.dark : colors.light;
    return `${base} ${themeColors[method.toLowerCase() as keyof typeof themeColors] || themeColors.default}`;
  };

  const groupedEndpoints = Object.entries(spec.paths).reduce((acc, [path, pathItem]) => {
    OpenAPIParser.getHttpMethods(pathItem).forEach((method) => {
      const operation = pathItem[method as keyof typeof pathItem] as any;
      const tags = operation?.tags || ['default'];
      tags.forEach((tag: string) => {
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push({ path, method, operation });
      });
    });
    return acc;
  }, {} as { [tag: string]: { path: string; method: string; operation: any }[] });

  const filteredGroups = Object.entries(groupedEndpoints).reduce((acc, [tag, endpoints]) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const filtered = endpoints.filter((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.operation?.summary || ''} ${tag}`.toLowerCase().includes(normalizedSearch));
    if (filtered.length) acc[tag] = filtered;
    return acc;
  }, {} as { [tag: string]: { path: string; method: string; operation: any }[] });

  const toggleTag = (tag: string) => setExpandedTags((current) => {
    const next = new Set(current); next.has(tag) ? next.delete(tag) : next.add(tag); return next;
  });

  return (
    <div className={`flex h-full w-full min-w-0 flex-col ${sidebarClasses}`} style={{ backgroundColor: 'var(--flexdoc-sidebar-bg)', color: 'var(--flexdoc-sidebar-text)' }}>
      <div className={`border-b p-4 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className='mb-4 flex items-center gap-3'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600'>
            <FileText className='h-4 w-4 text-white' />
          </div>
          <div className='min-w-0'>
            <h1 className={`truncate text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>FlexDoc</h1>
            <p className={`truncate text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>API Documentation</p>
          </div>
        </div>
        <label className='sr-only' htmlFor='flexdoc-endpoint-search'>Search endpoints</label>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
          <input id='flexdoc-endpoint-search' type='search' placeholder='Search endpoints...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full rounded-lg border py-2 pl-10 pr-4 text-sm transition-colors ${searchInputClasses}`} />
        </div>
      </div>

      <div className='flex-1 overflow-y-auto overscroll-contain'>
        <div className='p-4'>
          <div className='mb-6'>
            <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${sectionHeaderClasses}`}>API Information</h3>
            <div className='space-y-3'>
              <div className={`rounded-lg border p-3 ${cardClasses}`}>
                <h4 className={`truncate font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{spec.info.title}</h4>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Version {spec.info.version}</p>
              </div>
              {spec.servers && spec.servers.length > 0 && (
                <div className={`rounded-lg border p-3 ${cardClasses}`}>
                  <div className='mb-2 flex items-center gap-2'><Server className='h-4 w-4 text-gray-400' /><span className='text-sm font-medium'>Servers</span></div>
                  <div className='space-y-2'>
                    {spec.servers.map((server, index) => <div key={`${server.url}:${index}`} className='min-w-0 text-sm'>
                      <code className={`block max-w-full overflow-x-auto rounded px-1.5 py-0.5 text-xs ${theme === 'dark' ? 'bg-gray-700/50 text-blue-200' : 'bg-gray-100 text-blue-600'}`}>{server.url}</code>
                      {server.description && <p className={`mt-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{server.description}</p>}
                    </div>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${sectionHeaderClasses}`}>Endpoints</h3>
            {Object.keys(filteredGroups).length === 0 && <p className={`px-2 py-4 text-sm ${sectionHeaderClasses}`}>No endpoints match your search.</p>}
            {Object.entries(filteredGroups).map(([tag, endpoints]) => (
              <div key={tag} className='mb-4'>
                <button onClick={() => toggleTag(tag)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg p-2 text-left transition-colors ${theme === 'dark' ? 'hover:bg-gray-800/50 text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                  {expandedTags.has(tag) ? <ChevronDown className='h-4 w-4 shrink-0 text-gray-400' /> : <ChevronRight className='h-4 w-4 shrink-0 text-gray-400' />}
                  <Tag className='h-4 w-4 shrink-0 text-gray-400' />
                  <span className='min-w-0 truncate text-sm font-medium'>{tag === 'default' ? 'General' : tag}</span>
                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>{endpoints.length}</span>
                </button>
                {expandedTags.has(tag) && (
                  <div className='ml-4 mt-1.5 space-y-1.5 sm:ml-6'>
                    {endpoints.map(({ path, method, operation }) => {
                      const isSelected = selectedEndpoint?.path === path && selectedEndpoint?.method === method;
                      return <button key={`${method}-${path}`} onClick={() => onEndpointSelect(path, method)} className={`mb-2 min-h-11 w-full rounded-lg border p-2 text-left transition-all ${isSelected ? theme === 'dark' ? 'bg-blue-900/20 border-blue-800/50 shadow-sm' : 'bg-blue-50 border-blue-100 shadow-sm' : theme === 'dark' ? 'hover:bg-gray-800/50 border-transparent hover:border-gray-700' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`} style={isSelected ? { color: 'var(--flexdoc-sidebar-active-text)' } : undefined}>
                        <div className='mb-1 flex items-center gap-2'><span className={getMethodColor(method)}>{method.toUpperCase()}</span></div>
                        <div className={`break-all font-mono text-sm ${isSelected ? theme === 'dark' ? 'text-blue-300' : 'text-blue-600' : theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{path}</div>
                        {operation?.summary && <div className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{operation.summary}</div>}
                      </button>;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
