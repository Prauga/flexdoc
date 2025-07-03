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
  const [expandedTags, setExpandedTags] = useState<Set<string>>(
    new Set(['default'])
  );

  // Theme classes
  const sidebarClasses =
    theme === 'dark'
      ? 'bg-gray-900 border-r border-gray-800 text-white'
      : 'bg-white border-r border-gray-200 text-gray-700';

  const searchInputClasses =
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 focus:ring-1'
      : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 focus:ring-1';

  const sectionHeaderClasses =
    theme === 'dark' ? 'text-gray-300' : 'text-gray-500';

  const cardClasses =
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700 text-white'
      : 'bg-gray-50 border-gray-100 text-gray-700';

  const getMethodColor = (method: string) => {
    const base = 'text-xs font-bold px-2 py-0.5 rounded border';
    const colors = {
      dark: {
        get: 'bg-blue-900/30 border-blue-700 text-blue-200',
        post: 'bg-green-900/30 border-green-700 text-green-200',
        put: 'bg-yellow-900/30 border-yellow-700 text-yellow-200',
        patch: 'bg-purple-900/30 border-purple-700 text-purple-200',
        delete: 'bg-red-900/30 border-red-700 text-red-200',
        default: 'bg-gray-800/50 border-gray-700 text-gray-200',
      },
      light: {
        get: 'bg-blue-50 border-blue-200 text-blue-700',
        post: 'bg-green-50 border-green-200 text-green-700',
        put: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        patch: 'bg-purple-50 border-purple-200 text-purple-700',
        delete: 'bg-red-50 border-red-200 text-red-700',
        default: 'bg-gray-100 border-gray-200 text-gray-600',
      },
    };

    const themeColors = theme === 'dark' ? colors.dark : colors.light;
    const methodLower = method.toLowerCase();

    return `${base} ${
      themeColors[methodLower as keyof typeof themeColors] ||
      themeColors.default
    }`;
  };

  // Group endpoints by tags
  const groupedEndpoints = Object.entries(spec.paths).reduce(
    (acc, [path, pathItem]) => {
      const methods = OpenAPIParser.getHttpMethods(pathItem);

      methods.forEach((method) => {
        const operation = pathItem[method as keyof typeof pathItem] as any;
        const tags = operation?.tags || ['default'];

        tags.forEach((tag: string) => {
          if (!acc[tag]) {
            acc[tag] = [];
          }
          acc[tag].push({ path, method, operation });
        });
      });

      return acc;
    },
    {} as { [tag: string]: { path: string; method: string; operation: any }[] }
  );

  // Filter endpoints based on search
  const filteredGroups = Object.entries(groupedEndpoints).reduce(
    (acc, [tag, endpoints]) => {
      const filteredEndpoints = endpoints.filter((endpoint) => {
        const searchString = `${endpoint.method} ${endpoint.path} ${
          endpoint.operation?.summary || ''
        }`.toLowerCase();
        return searchString.includes(searchTerm.toLowerCase());
      });

      if (filteredEndpoints.length > 0) {
        acc[tag] = filteredEndpoints;
      }

      return acc;
    },
    {} as { [tag: string]: { path: string; method: string; operation: any }[] }
  );

  const toggleTag = (tag: string) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tag)) {
      newExpanded.delete(tag);
    } else {
      newExpanded.add(tag);
    }
    setExpandedTags(newExpanded);
  };

  return (
    <div className={`w-80 flex flex-col h-full ${sidebarClasses}`}>
      {/* Header */}
      <div
        className={`p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center'>
            <FileText className='w-4 h-4 text-white' />
          </div>
          <div>
            <h1
              className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              FlexDoc
            </h1>
            <p
              className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
            >
              API Documentation
            </p>
          </div>
        </div>

        {/* Search */}
        <div className='relative'>
          <Search
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}
          />
          <input
            type='text'
            placeholder='Search endpoints...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition-colors ${searchInputClasses}`}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className='flex-1 overflow-y-auto'>
        <div className='p-4'>
          {/* API Info */}
          <div className='mb-6'>
            <h3
              className={`text-xs font-semibold uppercase tracking-wider mb-2 ${sectionHeaderClasses}`}
            >
              API Information
            </h3>
            <div className='space-y-3'>
              <div className={`p-3 rounded-lg border ${cardClasses}`}>
                <h4
                  className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  {spec.info.title}
                </h4>
                <p
                  className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Version {spec.info.version}
                </p>
              </div>

              {spec.servers && spec.servers.length > 0 && (
                <div className={`p-3 rounded-lg border ${cardClasses}`}>
                  <div className='flex items-center gap-2 mb-2'>
                    <Server
                      className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                    />
                    <span
                      className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}
                    >
                      Servers
                    </span>
                  </div>
                  {spec.servers.map((server, index) => (
                    <div key={index} className='text-sm'>
                      <code
                        className={`px-1.5 py-0.5 rounded text-xs ${theme === 'dark' ? 'bg-gray-700/50 text-blue-200' : 'bg-gray-100 text-blue-600'}`}
                      >
                        {server.url}
                      </code>
                      {server.description && (
                        <p
                          className={`mt-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                        >
                          {server.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <h3
              className={`text-xs font-semibold uppercase tracking-wider mb-3 ${sectionHeaderClasses}`}
            >
              Endpoints
            </h3>

            {Object.entries(filteredGroups).map(([tag, endpoints]) => (
              <div key={tag} className='mb-4'>
                <button
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-2 w-full text-left p-2 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-gray-800/50 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {expandedTags.has(tag) ? (
                    <ChevronDown
                      className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                    />
                  ) : (
                    <ChevronRight
                      className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                    />
                  )}
                  <Tag
                    className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                  />
                  <span
                    className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}
                  >
                    {tag === 'default' ? 'General' : tag}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                      theme === 'dark'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {endpoints.length}
                  </span>
                </button>

                {expandedTags.has(tag) && (
                  <div className='ml-6 mt-1.5 space-y-1.5'>
                    {endpoints.map(({ path, method, operation }) => {
                      const isSelected =
                        selectedEndpoint?.path === path &&
                        selectedEndpoint?.method === method;
                      return (
                        <button
                          key={`${method}-${path}`}
                          onClick={() => onEndpointSelect(path, method)}
                          className={`w-full text-left p-2 rounded-lg transition-all mb-2 ${
                            isSelected
                              ? theme === 'dark'
                                ? 'bg-blue-900/20 border border-blue-800/50 shadow-sm'
                                : 'bg-blue-50 border border-blue-100 shadow-sm'
                              : theme === 'dark'
                                ? 'hover:bg-gray-800/50 border border-transparent hover:border-gray-700'
                                : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
                          }`}
                        >
                          <div className='flex items-center gap-2 mb-1'>
                            <span className={getMethodColor(method)}>
                              {method.toUpperCase()}
                            </span>
                          </div>
                          <div
                            className={`text-sm font-mono break-all ${
                              isSelected
                                ? theme === 'dark'
                                  ? 'text-blue-300'
                                  : 'text-blue-600'
                                : theme === 'dark'
                                  ? 'text-gray-300'
                                  : 'text-gray-800'
                            }`}
                          >
                            {path}
                          </div>
                          {operation?.summary && (
                            <div
                              className={`text-xs mt-1 ${
                                theme === 'dark'
                                  ? 'text-gray-400'
                                  : 'text-gray-600'
                              }`}
                            >
                              {operation.summary}
                            </div>
                          )}
                        </button>
                      );
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

