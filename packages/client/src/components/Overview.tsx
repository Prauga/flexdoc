import React from 'react';
import { FileText, Server, Shield, Tag, ExternalLink } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';

interface OverviewProps {
  spec: OpenAPISpec;
  onEndpointSelect: (path: string, method: string) => void;
  theme?: 'light' | 'dark';
}

export const Overview: React.FC<OverviewProps> = ({
  spec,
  onEndpointSelect,
  theme = 'light',
}) => {
  // Theme-specific classes

  const cardClasses =
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 shadow-lg text-white'
      : 'bg-white border-gray-200 shadow-sm text-gray-900';

  const textMuted = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  const hoverClasses =
    theme === 'dark'
      ? 'hover:bg-gray-700 hover:border-gray-600'
      : 'hover:border-blue-300 hover:bg-blue-50';

  // Get endpoint statistics
  const endpointStats = Object.entries(spec.paths).reduce(
    (acc, [_path, pathItem]) => {
      const methods = OpenAPIParser.getHttpMethods(pathItem);
      methods.forEach((method) => {
        acc[method] = (acc[method] || 0) + 1;
        acc.total++;
      });
      return acc;
    },
    { total: 0 } as { [key: string]: number }
  );

  // Get popular endpoints (first few for demo)
  const popularEndpoints = Object.entries(spec.paths)
    .slice(0, 6)
    .flatMap(([path, pathItem]) =>
      OpenAPIParser.getHttpMethods(pathItem).map((method) => ({
        path,
        method,
        operation: pathItem[method as keyof typeof pathItem] as any,
      }))
    );

  // Stats cards data
  const stats = [
    {
      icon: <FileText className='w-5 h-5' />,
      iconBg: theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100',
      iconColor: theme === 'dark' ? 'text-blue-300' : 'text-blue-600',
      title: 'Total Endpoints',
      value: endpointStats.total,
    },
    {
      icon: <Server className='w-5 h-5' />,
      iconBg: theme === 'dark' ? 'bg-green-900' : 'bg-green-100',
      iconColor: theme === 'dark' ? 'text-green-300' : 'text-green-600',
      title: 'Servers',
      value: spec.servers?.length || 0,
    },
    {
      icon: <Tag className='w-5 h-5' />,
      iconBg: theme === 'dark' ? 'bg-purple-900' : 'bg-purple-100',
      iconColor: theme === 'dark' ? 'text-purple-300' : 'text-purple-600',
      title: 'Tags',
      value: spec.tags?.length || 0,
    },
    {
      icon: <Shield className='w-5 h-5' />,
      iconBg: theme === 'dark' ? 'bg-orange-900' : 'bg-orange-100',
      iconColor: theme === 'dark' ? 'text-orange-300' : 'text-orange-600',
      title: 'Security Schemes',
      value: spec.components?.securitySchemes
        ? Object.keys(spec.components.securitySchemes).length
        : 0,
    },
  ];

  return (
    <div
      className={`flex-1 overflow-y-auto ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      <div className='p-4 md:p-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-4 mb-4'>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-blue-700'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600'
              }`}
            >
              <FileText className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1
                className={`text-2xl md:text-3xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {spec.info.title}
              </h1>
              <p
                className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Version {spec.info.version}
              </p>
            </div>
          </div>

          {spec.info.description && (
            <p
              className={`text-lg leading-relaxed max-w-4xl ${
                theme === 'dark' ? 'text-white' : 'text-gray-600'
              }`}
            >
              {spec.info.description}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border transition-colors ${cardClasses}`}
            >
              <div className='flex items-center gap-3'>
                <div
                  className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center`}
                >
                  {React.cloneElement(stat.icon, {
                    className: `${stat.iconColor} w-5 h-5`,
                  })}
                </div>
                <div>
                  <p className={`text-sm font-medium ${textMuted}`}>
                    {stat.title}
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Method Distribution */}
        <div className={`rounded-xl border p-4 md:p-6 mb-8 ${cardClasses}`}>
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            HTTP Methods Distribution
          </h2>
          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
            {['get', 'post', 'put', 'delete', 'patch', 'options'].map(
              (method) => (
                <div key={method} className='text-center'>
                  <div
                    className={`px-3 py-1.5 mx-auto rounded-lg flex items-center justify-center mb-2 ${OpenAPIParser.getMethodColor(
                      method,
                      theme
                    )}`}
                  >
                    <span className='text-sm font-medium'>
                      {method.toUpperCase()}
                    </span>
                  </div>
                  <p
                    className={`font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {endpointStats[method] || 0}
                  </p>
                  <p className='text-xs text-gray-400'>
                    {method.toUpperCase()}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Popular Endpoints */}
        <div className={`rounded-xl border p-4 md:p-6 mb-8 ${cardClasses}`}>
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Available Endpoints
          </h2>
          <div className='space-y-3'>
            {popularEndpoints.map(({ path, method, operation }) => (
              <button
                key={`${method}-${path}`}
                onClick={() => onEndpointSelect(path, method)}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${hoverClasses} ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                <div className='flex items-center gap-3'>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded border ${OpenAPIParser.getMethodColor(
                      method,
                      theme
                    )}`}
                  >
                    {method.toUpperCase()}
                  </span>
                  <code
                    className={`font-mono text-sm break-all ${
                      theme === 'dark'
                        ? 'text-blue-300 group-hover:text-blue-200'
                        : 'text-blue-600 group-hover:text-blue-700'
                    }`}
                  >
                    {path}
                  </code>
                </div>
                {operation?.summary && (
                  <p
                    className={`text-sm mt-2 ml-14 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {operation.summary}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Info */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Contact & License */}
          {(spec.info.contact || spec.info.license) && (
            <div className={`rounded-xl border p-4 md:p-6 ${cardClasses}`}>
              <h2
                className={`text-lg md:text-xl font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Information
              </h2>
              <div className='space-y-4'>
                {spec.info.contact && (
                  <div>
                    <h3
                      className={`font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Contact
                    </h3>
                    {spec.info.contact.name && (
                      <p className={`text-sm ${textMuted}`}>
                        {spec.info.contact.name}
                      </p>
                    )}
                    {spec.info.contact.email && (
                      <p className={`text-sm ${textMuted}`}>
                        {spec.info.contact.email}
                      </p>
                    )}
                    {spec.info.contact.url && (
                      <a
                        href={spec.info.contact.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`text-sm flex items-center gap-1 ${
                          theme === 'dark'
                            ? 'text-blue-400 hover:text-blue-300'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        Website <ExternalLink className='w-3 h-3' />
                      </a>
                    )}
                  </div>
                )}

                {spec.info.license && (
                  <div>
                    <h3
                      className={`font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      License
                    </h3>
                    {spec.info.license.url ? (
                      <a
                        href={spec.info.license.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`text-sm flex items-center gap-1 ${
                          theme === 'dark'
                            ? 'text-blue-400 hover:text-blue-300'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        {spec.info.license.name}
                        <ExternalLink className='w-3 h-3' />
                      </a>
                    ) : (
                      <p className={`text-sm ${textMuted}`}>
                        {spec.info.license.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Servers */}
          {spec.servers && spec.servers.length > 0 && (
            <div className={`rounded-xl border p-4 md:p-6 ${cardClasses}`}>
              <h2
                className={`text-lg md:text-xl font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Servers
              </h2>
              <div className='space-y-3'>
                {spec.servers.map((server, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}
                  >
                    <code
                      className={`text-sm font-mono ${
                        theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                      }`}
                    >
                      {server.url}
                    </code>
                    {server.description && (
                      <p className={`text-sm mt-1 ${textMuted}`}>
                        {server.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
