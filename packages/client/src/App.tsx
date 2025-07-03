import React, { useState, useEffect } from 'react';
import { Upload, FileText, Github, Star } from 'lucide-react';
import { FlexDoc } from './components/FlexDoc';
import { OpenAPIParser } from './utils/openapi-parser';
import { OpenAPISpec } from './types/openapi';
import { sampleSpec } from './data/sample-spec';
import { themeVariant } from './utils/theme';
import { Footer } from './components/Footer';

export interface AppProps {
  theme?: 'light' | 'dark';
}

export const App: React.FC<AppProps> = ({ theme = 'light' }) => {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Apply theme class to document element
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

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

  const containerClasses = themeVariant(
    theme,
    'bg-gradient-to-br from-blue-50 via-white to-indigo-100',
    'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
  );

  const textClasses = themeVariant(theme, 'text-gray-900', 'text-white');
  const cardClasses = themeVariant(
    theme,
    'bg-white border-gray-200',
    'bg-gray-800 border-gray-700'
  );
  const textMutedClasses = themeVariant(
    theme,
    'text-gray-600',
    'text-gray-400'
  );

  const uploadCardClasses = themeVariant(
    theme,
    'bg-white border-gray-200',
    'bg-gray-800 border-gray-700'
  );

  const uploadBorderClasses = themeVariant(
    theme,
    'border-gray-300 bg-gray-50',
    'border-gray-600 bg-gray-700/50'
  );

  const uploadHoverClasses = themeVariant(
    theme,
    'border-blue-300 hover:border-blue-400 hover:bg-blue-50',
    'border-blue-700 hover:border-blue-600 hover:bg-blue-900/20'
  );

  // Feature card theme variables
  const featureCardClasses = `rounded-xl p-6 shadow-sm border ${cardClasses} transition-all hover:shadow-md hover:-translate-y-0.5`;
  const featureIconWrapperClasses =
    'w-10 h-10 rounded-lg flex items-center justify-center mb-4';

  // Feature items data with theme-aware classes
  const features = [
    {
      icon: (
        <FileText
          className={`w-5 h-5 ${themeVariant(
            theme,
            'text-blue-600',
            'text-blue-400'
          )}`}
        />
      ),
      iconBg: themeVariant(theme, 'bg-blue-100', 'bg-blue-900/30'),
      title: 'Interactive Documentation',
      description:
        'Beautiful, responsive documentation with interactive API explorer and code examples.',
    },
    {
      icon: (
        <Star
          className={`w-5 h-5 ${themeVariant(
            theme,
            'text-green-600',
            'text-green-400'
          )}`}
        />
      ),
      iconBg: themeVariant(theme, 'bg-green-100', 'bg-green-900/30'),
      title: 'Modern Design',
      description:
        'Clean, professional interface with customizable themes and advanced styling options.',
    },
    {
      icon: (
        <Github
          className={`w-5 h-5 ${themeVariant(
            theme,
            'text-purple-600',
            'text-purple-400'
          )}`}
        />
      ),
      iconBg: themeVariant(theme, 'bg-purple-100', 'bg-purple-900/30'),
      title: 'Framework Integration',
      description:
        'Easy integration with NestJS and other popular backend frameworks.',
    },
  ];

  const footerClasses = themeVariant(
    theme,
    'border-t border-gray-200 bg-white text-gray-600',
    'border-t border-gray-700 bg-gray-800 text-gray-300'
  );

  if (spec) {
    return <FlexDoc spec={spec} theme={theme} />;
  }

  return (
    <div className='flex flex-col min-h-screen'>
      <div className='flex-1'>
        <div className={`min-h-screen ${containerClasses}`}>
          <div className={`container mx-auto px-6 py-12 ${textClasses}`}>
            {/* Header */}
            <div className='text-center mb-12'>
              <div className='flex items-center justify-center gap-3 mb-6'>
                <div className='w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center'>
                  <FileText className='w-8 h-8 text-white' />
                </div>
                <div className='text-left'>
                  <h1 className='text-4xl font-bold'>FlexDoc</h1>
                  <p className={`text-lg ${textMutedClasses}`}>
                    OpenAPI Documentation Generator
                  </p>
                </div>
              </div>

              <p
                className={`text-xl ${textMutedClasses} max-w-2xl mx-auto leading-relaxed`}
              >
                Generate beautiful, interactive API documentation from your
                OpenAPI 3.0 specifications. Built for modern web applications
                with customizable themes and advanced features.
              </p>

              <div className='flex items-center justify-center gap-6 mt-8'>
                <div className='flex items-center gap-2 text-sm'>
                  <a
                    href='https://spec.openapis.org/oas/v3.0.3'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 text-sm hover:opacity-80 transition-opacity'
                  >
                    <Star className='w-4 h-4 text-yellow-500' />
                    <span className={textMutedClasses}>
                      OpenAPI 3.0 Support
                    </span>
                  </a>
                </div>
                <div className='flex items-center gap-2 text-sm'>
                  <a
                    href='https://github.com/bluejeans117/flexdoc'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 text-sm hover:opacity-80 transition-opacity'
                  >
                    <Github className='w-4 h-4' />
                    <span className={textMutedClasses}>Open Source</span>
                  </a>
                </div>
                <div className='flex items-center gap-2 text-sm'>
                  <a
                    href='https://bluejeans117.github.io/flexdoc'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 text-sm hover:opacity-80 transition-opacity'
                  >
                    <FileText className='w-4 h-4 text-blue-500' />
                    <span className={textMutedClasses}>Interactive Docs</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Upload Section */}
            <div className='max-w-4xl mx-auto'>
              <div
                className={`rounded-2xl shadow-xl border p-8 mb-8 ${uploadCardClasses}`}
              >
                <h2
                  className={`text-2xl font-semibold text-center mb-6 ${textClasses}`}
                >
                  Get Started with Your API Documentation
                </h2>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                  {/* File Upload */}
                  <div className='space-y-4'>
                    <h3
                      className={`text-lg font-medium flex items-center gap-2 ${textClasses}`}
                    >
                      <Upload
                        className={`w-5 h-5 ${themeVariant(
                          theme,
                          'text-blue-600',
                          'text-blue-400'
                        )}`}
                      />
                      Upload OpenAPI File
                    </h3>
                    <p className={textMutedClasses}>
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
                          loading ? uploadBorderClasses : uploadHoverClasses
                        }`}
                      >
                        <Upload
                          className={`w-8 h-8 mx-auto mb-3 ${
                            loading
                              ? themeVariant(
                                  theme,
                                  'text-gray-400',
                                  'text-gray-500'
                                )
                              : themeVariant(
                                  theme,
                                  'text-blue-500',
                                  'text-blue-400'
                                )
                          }`}
                        />
                        <p className={`text-sm font-medium ${textClasses}`}>
                          {loading
                            ? 'Processing...'
                            : 'Click to upload or drag and drop'}
                        </p>
                        <p className={`text-xs ${textMutedClasses} mt-1`}>
                          Supports JSON and YAML files
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sample Spec */}
                  <div className='space-y-4'>
                    <h3
                      className={`text-lg font-medium flex items-center gap-2 ${textClasses}`}
                    >
                      <FileText
                        className={`w-5 h-5 ${themeVariant(
                          theme,
                          'text-green-600',
                          'text-green-500'
                        )}`}
                      />
                      Try Sample API
                    </h3>
                    <p className={textMutedClasses}>
                      Explore FlexDoc features with our sample Pet Store API
                      specification
                    </p>

                    <div className='space-y-3'>
                      <button
                        onClick={loadSampleSpec}
                        disabled={loading}
                        className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                          loading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        Load Sample Pet Store API
                      </button>

                      <div className={`text-xs ${textMutedClasses} space-y-1`}>
                        <p>• Multiple endpoints and operations</p>
                        <p>• Authentication examples</p>
                        <p>• Complex data models</p>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div
                    className={`mt-6 p-4 rounded-lg ${themeVariant(
                      theme,
                      'bg-red-50 border-red-200',
                      'bg-red-900/20 border-red-800'
                    )} border`}
                  >
                    <p
                      className={`text-sm font-medium ${themeVariant(
                        theme,
                        'text-red-700',
                        'text-red-400'
                      )}`}
                    >
                      Error: {error}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Features */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {features.map((feature, index) => (
                <div key={index} className={featureCardClasses}>
                  <div
                    className={`${featureIconWrapperClasses} ${feature.iconBg}`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className={`font-semibold mb-2 ${textClasses}`}>
                    {feature.title}
                  </h3>
                  <p className={`text-sm ${textMutedClasses}`}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer footerClasses={footerClasses} />
    </div>
  );
};

export default App;

