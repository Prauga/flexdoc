import React, { useState } from 'react';
import { Upload, FileText, Github, Star } from 'lucide-react';
import { FlexDoc } from './components/FlexDoc';
import { OpenAPIParser } from './utils/openapi-parser';
import { OpenAPISpec } from './types/openapi';
import { sampleSpec } from './data/sample-spec';

function App() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const parsedSpec = await OpenAPIParser.parseSpec(text);
      setSpec(parsedSpec);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse OpenAPI specification'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSampleSpec = () => {
    setSpec(sampleSpec);
  };

  const handleSpecFromUrl = async (url: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch specification');
      }
      const text = await response.text();
      const parsedSpec = await OpenAPIParser.parseSpec(text);
      setSpec(parsedSpec);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load specification from URL'
      );
    } finally {
      setLoading(false);
    }
  };

  if (spec) {
    return <FlexDoc spec={spec} />;
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100'>
      <div className='container mx-auto px-6 py-12'>
        {/* Header */}
        <div className='text-center mb-12'>
          <div className='flex items-center justify-center gap-3 mb-6'>
            <div className='w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center'>
              <FileText className='w-8 h-8 text-white' />
            </div>
            <div className='text-left'>
              <h1 className='text-4xl font-bold text-gray-900'>FlexDoc</h1>
              <p className='text-lg text-gray-600'>
                OpenAPI Documentation Generator
              </p>
            </div>
          </div>

          <p className='text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed'>
            Generate beautiful, interactive API documentation from your OpenAPI
            3.0 specifications. Built for modern web applications with
            customizable themes and advanced features.
          </p>

          <div className='flex items-center justify-center gap-6 mt-8'>
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Star className='w-4 h-4 text-yellow-500' />
              <span>OpenAPI 3.0 Support</span>
            </div>
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Github className='w-4 h-4' />
              <span>Open Source</span>
            </div>
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <FileText className='w-4 h-4 text-blue-500' />
              <span>Interactive Docs</span>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className='max-w-4xl mx-auto'>
          <div className='bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-8'>
            <h2 className='text-2xl font-semibold text-gray-900 mb-6 text-center'>
              Get Started with Your API Documentation
            </h2>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              {/* File Upload */}
              <div className='space-y-4'>
                <h3 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                  <Upload className='w-5 h-5 text-blue-600' />
                  Upload OpenAPI File
                </h3>
                <p className='text-gray-600 text-sm'>
                  Upload your OpenAPI 3.0 specification file (JSON or YAML
                  format)
                </p>

                <div className='relative'>
                  <input
                    type='file'
                    accept='.json,.yaml,.yml'
                    onChange={handleFileUpload}
                    disabled={loading}
                    className='absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed'
                  />
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      loading
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <Upload
                      className={`w-8 h-8 mx-auto mb-3 ${
                        loading ? 'text-gray-400' : 'text-blue-500'
                      }`}
                    />
                    <p className='text-sm font-medium text-gray-900'>
                      {loading
                        ? 'Processing...'
                        : 'Click to upload or drag and drop'}
                    </p>
                    <p className='text-xs text-gray-500 mt-1'>
                      Supports JSON and YAML files
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Spec */}
              <div className='space-y-4'>
                <h3 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                  <FileText className='w-5 h-5 text-green-600' />
                  Try Sample API
                </h3>
                <p className='text-gray-600 text-sm'>
                  Explore FlexDoc features with our sample Pet Store API
                  specification
                </p>

                <div className='space-y-3'>
                  <button
                    onClick={loadSampleSpec}
                    disabled={loading}
                    className='w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors'
                  >
                    Load Sample Pet Store API
                  </button>

                  <div className='text-xs text-gray-500 space-y-1'>
                    <p>• Multiple endpoints and operations</p>
                    <p>• Authentication examples</p>
                    <p>• Complex data models</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
                <p className='text-red-700 text-sm font-medium'>
                  Error: {error}
                </p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <div className='bg-white rounded-xl p-6 shadow-sm border border-gray-200'>
              <div className='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4'>
                <FileText className='w-5 h-5 text-blue-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Interactive Documentation
              </h3>
              <p className='text-gray-600 text-sm'>
                Beautiful, responsive documentation with interactive API
                explorer and code examples.
              </p>
            </div>

            <div className='bg-white rounded-xl p-6 shadow-sm border border-gray-200'>
              <div className='w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4'>
                <Star className='w-5 h-5 text-green-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Modern Design
              </h3>
              <p className='text-gray-600 text-sm'>
                Clean, professional interface with customizable themes and
                advanced styling options.
              </p>
            </div>

            <div className='bg-white rounded-xl p-6 shadow-sm border border-gray-200'>
              <div className='w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4'>
                <Github className='w-5 h-5 text-purple-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Framework Integration
              </h3>
              <p className='text-gray-600 text-sm'>
                Easy integration with NestJS and other popular backend
                frameworks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
