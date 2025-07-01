import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Tag,
  Server,
} from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';

interface SidebarProps {
  spec: OpenAPISpec;
  onEndpointSelect: (path: string, method: string) => void;
  selectedEndpoint?: { path: string; method: string };
}

export const Sidebar: React.FC<SidebarProps> = ({
  spec,
  onEndpointSelect,
  selectedEndpoint,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(
    new Set(['default'])
  );

  // Group endpoints by tags
  const groupedEndpoints = Object.entries(spec.paths).reduce(
    (acc, [path, pathItem]) => {
      const methods = OpenAPIParser.getHttpMethods(pathItem);

      methods.forEach((method) => {
        const operation = pathItem[method as keyof typeof pathItem] as any;
        const tags = operation?.tags || ['default'];

        tags.forEach((tag) => {
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
    <div className='w-80 bg-white border-r border-gray-200 flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b border-gray-200'>
        <div className='flex items-center gap-3 mb-4'>
          <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center'>
            <FileText className='w-4 h-4 text-white' />
          </div>
          <div>
            <h1 className='text-lg font-semibold text-gray-900'>FlexDoc</h1>
            <p className='text-sm text-gray-500'>API Documentation</p>
          </div>
        </div>

        {/* Search */}
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
          <input
            type='text'
            placeholder='Search endpoints...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
          />
        </div>
      </div>

      {/* Navigation */}
      <div className='flex-1 overflow-y-auto'>
        <div className='p-4'>
          {/* API Info */}
          <div className='mb-6'>
            <h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
              API Information
            </h3>
            <div className='space-y-2'>
              <div className='p-3 bg-gray-50 rounded-lg'>
                <h4 className='font-medium text-gray-900'>{spec.info.title}</h4>
                <p className='text-sm text-gray-600'>
                  Version {spec.info.version}
                </p>
              </div>

              {spec.servers && spec.servers.length > 0 && (
                <div className='p-3 bg-gray-50 rounded-lg'>
                  <div className='flex items-center gap-2 mb-2'>
                    <Server className='w-4 h-4 text-gray-500' />
                    <span className='text-sm font-medium text-gray-700'>
                      Servers
                    </span>
                  </div>
                  {spec.servers.map((server, index) => (
                    <div key={index} className='text-sm text-gray-600'>
                      <code className='text-xs bg-gray-200 px-1 rounded'>
                        {server.url}
                      </code>
                      {server.description && (
                        <p className='mt-1'>{server.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>
              Endpoints
            </h3>

            {Object.entries(filteredGroups).map(([tag, endpoints]) => (
              <div key={tag} className='mb-4'>
                <button
                  onClick={() => toggleTag(tag)}
                  className='flex items-center gap-2 w-full text-left p-2 hover:bg-gray-50 rounded-lg transition-colors'
                >
                  {expandedTags.has(tag) ? (
                    <ChevronDown className='w-4 h-4 text-gray-500' />
                  ) : (
                    <ChevronRight className='w-4 h-4 text-gray-500' />
                  )}
                  <Tag className='w-4 h-4 text-gray-500' />
                  <span className='text-sm font-medium text-gray-700 capitalize'>
                    {tag === 'default' ? 'General' : tag}
                  </span>
                  <span className='text-xs text-gray-500 ml-auto'>
                    {endpoints.length}
                  </span>
                </button>

                {expandedTags.has(tag) && (
                  <div className='ml-6 mt-2 space-y-1'>
                    {endpoints.map(({ path, method, operation }) => (
                      <button
                        key={`${method}-${path}`}
                        onClick={() => onEndpointSelect(path, method)}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedEndpoint?.path === path &&
                          selectedEndpoint?.method === method
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className='flex items-center gap-2 mb-1'>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded border ${OpenAPIParser.getMethodColor(
                              method
                            )}`}
                          >
                            {method.toUpperCase()}
                          </span>
                        </div>
                        <div className='text-sm text-gray-900 font-mono break-all'>
                          {path}
                        </div>
                        {operation?.summary && (
                          <div className='text-xs text-gray-600 mt-1'>
                            {operation.summary}
                          </div>
                        )}
                      </button>
                    ))}
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
