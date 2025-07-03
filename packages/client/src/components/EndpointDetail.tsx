import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import { OpenAPISpec, Operation, Schema } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';
import { isRequestBody } from '../utils/type-guards';
import { CodeBlock } from './CodeBlock';

interface EndpointDetailProps {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme?: 'light' | 'dark';
}

export const EndpointDetail: React.FC<EndpointDetailProps> = ({
  spec,
  path,
  method,
  theme = 'light',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'parameters', 'responses'])
  );

  // Theme classes
  const containerClasses =
    theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800';

  const sectionTitleClasses =
    theme === 'dark'
      ? 'text-gray-100 hover:text-blue-400'
      : 'text-gray-900 hover:text-blue-600';

  const cardClasses =
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200';

  const textMutedClasses = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

  const pathItem = spec.paths[path];
  const operation = pathItem[method as keyof typeof pathItem] as Operation;

  if (!operation) {
    return <div>Operation not found</div>;
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const renderSchema = (schema: Schema | any, level = 0): React.ReactNode => {
    if (OpenAPIParser.isReference(schema)) {
      const resolved = OpenAPIParser.resolveReference(spec, schema.$ref);
      return renderSchema(resolved, level);
    }

    const indent = level * 16;
    const typeColor = theme === 'dark' ? 'text-blue-300' : 'text-blue-600';
    const bgRequired =
      theme === 'dark'
        ? 'bg-red-900/30 text-red-300'
        : 'bg-red-100 text-red-700';
    const bgNullable =
      theme === 'dark'
        ? 'bg-gray-700 text-gray-300'
        : 'bg-gray-100 text-gray-700';

    return (
      <div style={{ marginLeft: indent }}>
        <div className='flex items-center gap-2 py-1 flex-wrap'>
          <span className={`text-sm ${typeColor}`}>
            {schema.type || 'any'}
            {schema.format && ` (${schema.format})`}
          </span>
          {schema.required && (
            <span className={`text-xs px-2 py-0.5 rounded ${bgRequired}`}>
              required
            </span>
          )}
          {schema.nullable && (
            <span className={`text-xs px-2 py-0.5 rounded ${bgNullable}`}>
              nullable
            </span>
          )}
        </div>

        {schema.description && (
          <p className={`text-sm mt-1 ${textMutedClasses}`}>
            {schema.description}
          </p>
        )}

        {schema.example !== undefined && (
          <div className='mt-2'>
            <CodeBlock
              code={JSON.stringify(schema.example, null, 2)}
              language='json'
              title='Example'
              showCopy={false}
              theme={theme}
            />
          </div>
        )}

        {schema.properties && (
          <div className='mt-2'>
            {Object.entries(schema.properties).map(([propName, propSchema]) => {
              const borderColor =
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
              const textColor =
                theme === 'dark' ? 'text-gray-100' : 'text-gray-900';

              return (
                <div
                  key={propName}
                  className={`border-l-2 ${borderColor} pl-3 mt-2`}
                >
                  <div className={`font-mono text-sm font-medium ${textColor}`}>
                    {propName}
                  </div>
                  {renderSchema(propSchema, level + 1)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    const code = parseInt(status);
    if (theme === 'dark') {
      if (code >= 200 && code < 300)
        return 'text-green-400 bg-green-900/30 border-green-800';
      if (code >= 300 && code < 400)
        return 'text-blue-400 bg-blue-900/30 border-blue-800';
      if (code >= 400 && code < 500)
        return 'text-orange-400 bg-orange-900/30 border-orange-800';
      if (code >= 500) return 'text-red-400 bg-red-900/30 border-red-800';
      return 'text-gray-400 bg-gray-800/50 border-gray-700';
    } else {
      if (code >= 200 && code < 300)
        return 'text-green-600 bg-green-50 border-green-200';
      if (code >= 300 && code < 400)
        return 'text-blue-600 bg-blue-50 border-blue-200';
      if (code >= 400 && code < 500)
        return 'text-orange-600 bg-orange-50 border-orange-200';
      if (code >= 500) return 'text-red-600 bg-red-50 border-red-200';
      return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getParamColor = (inType: string) => {
    if (theme === 'dark') {
      switch (inType) {
        case 'path':
          return 'bg-purple-900/30 text-purple-300';
        case 'query':
          return 'bg-blue-900/30 text-blue-300';
        case 'header':
          return 'bg-green-900/30 text-green-300';
        default:
          return 'bg-gray-800 text-gray-300';
      }
    } else {
      switch (inType) {
        case 'path':
          return 'bg-purple-100 text-purple-700';
        case 'query':
          return 'bg-blue-100 text-blue-700';
        case 'header':
          return 'bg-green-100 text-green-700';
        default:
          return 'bg-gray-100 text-gray-700';
      }
    }
  };

  const generateCurlExample = () => {
    let curl = `curl -X ${method.toUpperCase()} `;
    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    curl += `"${baseUrl}${path}"`;
    curl += ` \\n  -H "Content-Type: application/json"`;

    if (operation.security) {
      curl += ` \\n  -H "Authorization: Bearer YOUR_TOKEN"`;
    }

    if (
      ['post', 'put', 'patch'].includes(method.toLowerCase()) &&
      operation.requestBody
    ) {
      curl += ` \\n  -d '{}'`;
    }

    return curl;
  };

  const renderSection = (
    title: string,
    section: string,
    children: React.ReactNode
  ) => (
    <div className='mb-8'>
      <button
        onClick={() => toggleSection(section)}
        className={`flex items-center gap-2 text-lg font-semibold mb-4 transition-colors ${sectionTitleClasses}`}
      >
        {expandedSections.has(section) ? (
          <ChevronDown className='w-5 h-5' />
        ) : (
          <ChevronRight className='w-5 h-5' />
        )}
        {title}
      </button>

      {expandedSections.has(section) && children}
    </div>
  );

  return (
    <div className={`flex-1 overflow-y-auto ${containerClasses}`}>
      <div className='p-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <span
              className={`text-sm font-bold px-3 py-1 rounded border ${OpenAPIParser.getMethodColor(
                method,
                theme
              )}`}
            >
              {method.toUpperCase()}
            </span>
            <code
              className={`text-lg font-mono font-medium px-3 py-1 rounded ${
                theme === 'dark'
                  ? 'bg-gray-800 text-blue-300'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {path}
            </code>
          </div>

          {operation.summary && (
            <h1
              className={`text-2xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {operation.summary}
            </h1>
          )}

          {operation.description && (
            <p className={`${textMutedClasses} leading-relaxed`}>
              {operation.description}
            </p>
          )}

          <div className='flex items-center gap-4 mt-4'>
            {operation.deprecated && (
              <div
                className={`flex items-center gap-1 ${
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                }`}
              >
                <AlertCircle className='w-4 h-4' />
                <span className='text-sm font-medium'>Deprecated</span>
              </div>
            )}

            {operation.security ? (
              <div
                className={`flex items-center gap-1 ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`}
              >
                <Lock className='w-4 h-4' />
                <span className='text-sm'>Authentication required</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1 ${
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                }`}
              >
                <Unlock className='w-4 h-4' />
                <span className='text-sm'>No authentication required</span>
              </div>
            )}
          </div>
        </div>

        {/* Parameters Section */}
        {(operation.parameters || pathItem.parameters) &&
          renderSection(
            'Parameters',
            'parameters',
            <div className='space-y-4'>
              {[
                ...(pathItem.parameters || []),
                ...(operation.parameters || []),
              ].map((param: any, index) => {
                const parameter = OpenAPIParser.isReference(param)
                  ? OpenAPIParser.resolveReference(spec, param.$ref)
                  : param;

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${cardClasses} ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className='flex items-center gap-2 mb-2 flex-wrap'>
                      <code
                        className={`font-mono font-medium ${
                          theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}
                      >
                        {parameter.name}
                      </code>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${getParamColor(parameter.in)}`}
                      >
                        {parameter.in}
                      </span>
                      {parameter.required && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            theme === 'dark'
                              ? 'bg-red-900/30 text-red-300'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          required
                        </span>
                      )}
                    </div>

                    {parameter.description && (
                      <p className={`text-sm mb-3 ${textMutedClasses}`}>
                        {parameter.description}
                      </p>
                    )}

                    {parameter.schema && renderSchema(parameter.schema)}
                  </div>
                );
              })}
            </div>
          )}

        {/* Request Body Section */}
        {operation.requestBody &&
          renderSection(
            'Request Body',
            'requestBody',
            operation.requestBody && isRequestBody(operation.requestBody) && (
              <div className='space-y-4'>
                {Object.entries(operation.requestBody.content || {}).map(
                  ([mediaType, content]: [string, any]) => (
                    <div
                      key={mediaType}
                      className={`border rounded-lg p-4 ${cardClasses} ${
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      }`}
                    >
                      <div className='flex items-center gap-2 mb-3'>
                        <code
                          className={`text-sm px-2 py-1 rounded ${
                            theme === 'dark'
                              ? 'bg-gray-700 text-blue-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {mediaType}
                        </code>
                        {operation.requestBody &&
                          isRequestBody(operation.requestBody) &&
                          operation.requestBody.required && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                theme === 'dark'
                                  ? 'bg-red-900/30 text-red-300'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              required
                            </span>
                          )}
                      </div>

                      {content.schema && renderSchema(content.schema)}
                    </div>
                  )
                )}
              </div>
            )
          )}

        {/* Responses Section */}
        {renderSection(
          'Responses',
          'responses',
          <div className='space-y-4'>
            {Object.entries(operation.responses).map(
              ([statusCode, response]: [string, any]) => {
                const resolvedResponse = OpenAPIParser.isReference(response)
                  ? OpenAPIParser.resolveReference(spec, response.$ref)
                  : response;

                return (
                  <div
                    key={statusCode}
                    className={`border rounded-lg p-4 ${cardClasses} ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className='flex items-center gap-2 mb-3 flex-wrap'>
                      <span
                        className={`text-sm font-bold px-3 py-1 rounded border ${getStatusColor(statusCode)}`}
                      >
                        {statusCode}
                      </span>
                      <span className={`text-sm ${textMutedClasses}`}>
                        {resolvedResponse.description}
                      </span>
                    </div>

                    {resolvedResponse.content &&
                      Object.entries(resolvedResponse.content).map(
                        ([mediaType, content]: [string, any]) => (
                          <div key={mediaType} className='mt-3'>
                            <code
                              className={`text-sm px-2 py-1 rounded ${
                                theme === 'dark'
                                  ? 'bg-gray-700 text-blue-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {mediaType}
                            </code>
                            {content.schema && (
                              <div className='mt-2'>
                                {renderSchema(content.schema)}
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* Code Examples Section */}
        {renderSection(
          'Code Examples',
          'examples',
          <div className='space-y-4'>
            <CodeBlock
              code={generateCurlExample()}
              language='bash'
              title='cURL'
              theme={theme}
            />
          </div>
        )}
      </div>
    </div>
  );
};

