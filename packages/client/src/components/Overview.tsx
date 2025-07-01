import React from 'react';
import { FileText, Server, Shield, Tag, ExternalLink } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';

interface OverviewProps {
  spec: OpenAPISpec;
  onEndpointSelect: (path: string, method: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({
  spec,
  onEndpointSelect,
}) => {
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

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='p-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center'>
              <FileText className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>
                {spec.info.title}
              </h1>
              <p className='text-gray-600'>Version {spec.info.version}</p>
            </div>
          </div>

          {spec.info.description && (
            <p className='text-lg text-gray-600 leading-relaxed max-w-4xl'>
              {spec.info.description}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white p-6 rounded-xl border border-gray-200 shadow-sm'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                <FileText className='w-5 h-5 text-blue-600' />
              </div>
              <div>
                <p className='text-sm text-gray-500 font-medium'>
                  Total Endpoints
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {endpointStats.total}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-xl border border-gray-200 shadow-sm'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center'>
                <Server className='w-5 h-5 text-green-600' />
              </div>
              <div>
                <p className='text-sm text-gray-500 font-medium'>Servers</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {spec.servers?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-xl border border-gray-200 shadow-sm'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center'>
                <Tag className='w-5 h-5 text-purple-600' />
              </div>
              <div>
                <p className='text-sm text-gray-500 font-medium'>Tags</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {spec.tags?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-xl border border-gray-200 shadow-sm'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center'>
                <Shield className='w-5 h-5 text-orange-600' />
              </div>
              <div>
                <p className='text-sm text-gray-500 font-medium'>
                  Security Schemes
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {spec.components?.securitySchemes
                    ? Object.keys(spec.components.securitySchemes).length
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Method Distribution */}
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8'>
          <h2 className='text-xl font-semibold text-gray-900 mb-4'>
            HTTP Methods Distribution
          </h2>
          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
            {['get', 'post', 'put', 'delete', 'patch', 'options'].map(
              (method) => (
                <div key={method} className='text-center'>
                  <div
                    className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2 ${OpenAPIParser.getMethodColor(
                      method
                    )}`}
                  >
                    <span className='text-xs font-bold'>
                      {method.toUpperCase()}
                    </span>
                  </div>
                  <p className='text-lg font-bold text-gray-900'>
                    {endpointStats[method] || 0}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {method.toUpperCase()}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Popular Endpoints */}
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8'>
          <h2 className='text-xl font-semibold text-gray-900 mb-4'>
            Available Endpoints
          </h2>
          <div className='space-y-3'>
            {popularEndpoints.map(({ path, method, operation }) => (
              <button
                key={`${method}-${path}`}
                onClick={() => onEndpointSelect(path, method)}
                className='w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group'
              >
                <div className='flex items-center gap-3'>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded border ${OpenAPIParser.getMethodColor(
                      method
                    )}`}
                  >
                    {method.toUpperCase()}
                  </span>
                  <code className='font-mono text-sm text-gray-900 group-hover:text-blue-600'>
                    {path}
                  </code>
                </div>
                {operation?.summary && (
                  <p className='text-sm text-gray-600 mt-2 ml-16'>
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
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6'>
              <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                Information
              </h2>
              <div className='space-y-4'>
                {spec.info.contact && (
                  <div>
                    <h3 className='font-medium text-gray-900 mb-2'>Contact</h3>
                    {spec.info.contact.name && (
                      <p className='text-sm text-gray-600'>
                        {spec.info.contact.name}
                      </p>
                    )}
                    {spec.info.contact.email && (
                      <p className='text-sm text-gray-600'>
                        {spec.info.contact.email}
                      </p>
                    )}
                    {spec.info.contact.url && (
                      <a
                        href={spec.info.contact.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1'
                      >
                        Website <ExternalLink className='w-3 h-3' />
                      </a>
                    )}
                  </div>
                )}

                {spec.info.license && (
                  <div>
                    <h3 className='font-medium text-gray-900 mb-2'>License</h3>
                    {spec.info.license.url ? (
                      <a
                        href={spec.info.license.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1'
                      >
                        {spec.info.license.name}{' '}
                        <ExternalLink className='w-3 h-3' />
                      </a>
                    ) : (
                      <p className='text-sm text-gray-600'>
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
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6'>
              <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                Servers
              </h2>
              <div className='space-y-3'>
                {spec.servers.map((server, index) => (
                  <div key={index} className='p-3 bg-gray-50 rounded-lg'>
                    <code className='text-sm font-mono text-blue-600'>
                      {server.url}
                    </code>
                    {server.description && (
                      <p className='text-sm text-gray-600 mt-1'>
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
