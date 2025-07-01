import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { OpenAPISpec, Operation, Parameter, Schema } from '../types/openapi';
import { OpenAPIParser } from '../utils/openapi-parser';
import { CodeBlock } from './CodeBlock';

interface EndpointDetailProps {
  spec: OpenAPISpec;
  path: string;
  method: string;
}

export const EndpointDetail: React.FC<EndpointDetailProps> = ({
  spec,
  path,
  method,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'parameters', 'responses'])
  );

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

    return (
      <div style={{ marginLeft: indent }}>
        <div className='flex items-center gap-2 py-1'>
          <span className='text-sm text-gray-600'>
            {schema.type || 'any'}
            {schema.format && ` (${schema.format})`}
          </span>
          {schema.required && (
            <span className='text-xs bg-red-100 text-red-700 px-1 rounded'>
              required
            </span>
          )}
          {schema.nullable && (
            <span className='text-xs bg-gray-100 text-gray-700 px-1 rounded'>
              nullable
            </span>
          )}
        </div>

        {schema.description && (
          <p className='text-sm text-gray-600 mt-1'>{schema.description}</p>
        )}

        {schema.example !== undefined && (
          <div className='mt-2'>
            <CodeBlock
              code={JSON.stringify(schema.example, null, 2)}
              language='json'
              title='Example'
              showCopy={false}
            />
          </div>
        )}

        {schema.properties && (
          <div className='mt-2'>
            {Object.entries(schema.properties).map(([propName, propSchema]) => (
              <div
                key={propName}
                className='border-l-2 border-gray-200 pl-3 mt-2'
              >
                <div className='font-mono text-sm font-medium text-gray-900'>
                  {propName}
                </div>
                {renderSchema(propSchema, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    const code = parseInt(status);
    if (code >= 200 && code < 300)
      return 'text-green-600 bg-green-50 border-green-200';
    if (code >= 300 && code < 400)
      return 'text-blue-600 bg-blue-50 border-blue-200';
    if (code >= 400 && code < 500)
      return 'text-orange-600 bg-orange-50 border-orange-200';
    if (code >= 500) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const generateCurlExample = () => {
    let curl = `curl -X ${method.toUpperCase()} `;

    // Add server URL if available
    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    curl += `"${baseUrl}${path}"`;

    // Add headers
    curl += ` \\\n  -H "Content-Type: application/json"`;

    // Add auth if required
    if (operation.security) {
      curl += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
    }

    // Add request body example for POST/PUT/PATCH
    if (
      ['post', 'put', 'patch'].includes(method.toLowerCase()) &&
      operation.requestBody
    ) {
      curl += ` \\\n  -d '{}'`;
    }

    return curl;
  };

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='p-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <span
              className={`text-sm font-bold px-3 py-1 rounded border ${OpenAPIParser.getMethodColor(
                method
              )}`}
            >
              {method.toUpperCase()}
            </span>
            <code className='text-lg font-mono font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded'>
              {path}
            </code>
          </div>

          {operation.summary && (
            <h1 className='text-2xl font-bold text-gray-900 mb-2'>
              {operation.summary}
            </h1>
          )}

          {operation.description && (
            <p className='text-gray-600 leading-relaxed'>
              {operation.description}
            </p>
          )}

          <div className='flex items-center gap-4 mt-4'>
            {operation.deprecated && (
              <div className='flex items-center gap-1 text-orange-600'>
                <AlertCircle className='w-4 h-4' />
                <span className='text-sm font-medium'>Deprecated</span>
              </div>
            )}

            {operation.security ? (
              <div className='flex items-center gap-1 text-red-600'>
                <Lock className='w-4 h-4' />
                <span className='text-sm'>Authentication required</span>
              </div>
            ) : (
              <div className='flex items-center gap-1 text-green-600'>
                <Unlock className='w-4 h-4' />
                <span className='text-sm'>No authentication required</span>
              </div>
            )}
          </div>
        </div>

        {/* Parameters Section */}
        {(operation.parameters || pathItem.parameters) && (
          <div className='mb-8'>
            <button
              onClick={() => toggleSection('parameters')}
              className='flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors'
            >
              {expandedSections.has('parameters') ? (
                <ChevronDown className='w-5 h-5' />
              ) : (
                <ChevronRight className='w-5 h-5' />
              )}
              Parameters
            </button>

            {expandedSections.has('parameters') && (
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
                      className='border border-gray-200 rounded-lg p-4'
                    >
                      <div className='flex items-center gap-2 mb-2'>
                        <code className='font-mono font-medium text-gray-900'>
                          {parameter.name}
                        </code>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            parameter.in === 'path'
                              ? 'bg-purple-100 text-purple-700'
                              : parameter.in === 'query'
                              ? 'bg-blue-100 text-blue-700'
                              : parameter.in === 'header'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {parameter.in}
                        </span>
                        {parameter.required && (
                          <span className='text-xs bg-red-100 text-red-700 px-2 py-1 rounded'>
                            required
                          </span>
                        )}
                      </div>

                      {parameter.description && (
                        <p className='text-sm text-gray-600 mb-3'>
                          {parameter.description}
                        </p>
                      )}

                      {parameter.schema && renderSchema(parameter.schema)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Request Body Section */}
        {operation.requestBody && (
          <div className='mb-8'>
            <button
              onClick={() => toggleSection('requestBody')}
              className='flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors'
            >
              {expandedSections.has('requestBody') ? (
                <ChevronDown className='w-5 h-5' />
              ) : (
                <ChevronRight className='w-5 h-5' />
              )}
              Request Body
            </button>

            {expandedSections.has('requestBody') && (
              <div className='space-y-4'>
                {Object.entries(operation.requestBody.content || {}).map(
                  ([mediaType, content]) => (
                    <div
                      key={mediaType}
                      className='border border-gray-200 rounded-lg p-4'
                    >
                      <div className='flex items-center gap-2 mb-3'>
                        <code className='text-sm bg-gray-100 px-2 py-1 rounded'>
                          {mediaType}
                        </code>
                        {operation.requestBody?.required && (
                          <span className='text-xs bg-red-100 text-red-700 px-2 py-1 rounded'>
                            required
                          </span>
                        )}
                      </div>

                      {content.schema && renderSchema(content.schema)}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Responses Section */}
        <div className='mb-8'>
          <button
            onClick={() => toggleSection('responses')}
            className='flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors'
          >
            {expandedSections.has('responses') ? (
              <ChevronDown className='w-5 h-5' />
            ) : (
              <ChevronRight className='w-5 h-5' />
            )}
            Responses
          </button>

          {expandedSections.has('responses') && (
            <div className='space-y-4'>
              {Object.entries(operation.responses).map(
                ([statusCode, response]: [string, any]) => {
                  const resolvedResponse = OpenAPIParser.isReference(response)
                    ? OpenAPIParser.resolveReference(spec, response.$ref)
                    : response;

                  return (
                    <div
                      key={statusCode}
                      className='border border-gray-200 rounded-lg p-4'
                    >
                      <div className='flex items-center gap-2 mb-3'>
                        <span
                          className={`text-sm font-bold px-3 py-1 rounded border ${getStatusColor(
                            statusCode
                          )}`}
                        >
                          {statusCode}
                        </span>
                        <span className='text-sm text-gray-600'>
                          {resolvedResponse.description}
                        </span>
                      </div>

                      {resolvedResponse.content &&
                        Object.entries(resolvedResponse.content).map(
                          ([mediaType, content]: [string, any]) => (
                            <div key={mediaType} className='mt-3'>
                              <code className='text-sm bg-gray-100 px-2 py-1 rounded'>
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
        </div>

        {/* Code Examples Section */}
        <div className='mb-8'>
          <button
            onClick={() => toggleSection('examples')}
            className='flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors'
          >
            {expandedSections.has('examples') ? (
              <ChevronDown className='w-5 h-5' />
            ) : (
              <ChevronRight className='w-5 h-5' />
            )}
            Code Examples
          </button>

          {expandedSections.has('examples') && (
            <div className='space-y-4'>
              <CodeBlock
                code={generateCurlExample()}
                language='bash'
                title='cURL'
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
