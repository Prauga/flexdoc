import { FlexDocOptions, LogoOptions } from './interfaces';

export function generateFlexDocHTML(
  spec: object | null,
  options: FlexDocOptions & { specUrl?: string } = {}
): string {
  const {
    title = 'API Documentation',
    description = 'Interactive API documentation powered by FlexDoc',
    theme = 'light',
    customCss = '',
    customJs = '',
    favicon = '',
    logo = '',
    specUrl,
    theme_,
  } = options;

  // Process logo options
  let logoUrl = '';
  let logoStyle = '';
  let logoContainerStyle = '';
  let logoContainerClass = '';
  let logoAlt = 'Logo';
  let logoClickable = false;

  if (logo) {
    if (typeof logo === 'string') {
      logoUrl = logo;
    } else {
      logoUrl = logo.url;
      logoAlt = logo.alt || 'Logo';
      logoClickable = logo.clickable || false;

      // Build logo style
      const logoStyles = [];
      if (logo.maxHeight) {
        logoStyles.push(
          `max-height: ${
            typeof logo.maxHeight === 'number'
              ? `${logo.maxHeight}px`
              : logo.maxHeight
          }`
        );
      }
      if (logo.maxWidth) {
        logoStyles.push(
          `max-width: ${
            typeof logo.maxWidth === 'number'
              ? `${logo.maxWidth}px`
              : logo.maxWidth
          }`
        );
      }
      logoStyle =
        logoStyles.length > 0 ? ` style="${logoStyles.join('; ')}"` : '';

      // Build container style
      const containerStyles = [];
      if (logo.backgroundColor) {
        containerStyles.push(`background-color: ${logo.backgroundColor}`);
      }

      // Handle padding
      if (logo.padding) {
        if (typeof logo.padding === 'string') {
          containerStyles.push(`padding: ${logo.padding}`);
        } else {
          const vertical = logo.padding.vertical
            ? typeof logo.padding.vertical === 'number'
              ? `${logo.padding.vertical}px`
              : logo.padding.vertical
            : '0';
          const horizontal = logo.padding.horizontal
            ? typeof logo.padding.horizontal === 'number'
              ? `${logo.padding.horizontal}px`
              : logo.padding.horizontal
            : '0';
          containerStyles.push(`padding: ${vertical} ${horizontal}`);
        }
      }

      logoContainerStyle =
        containerStyles.length > 0
          ? ` style="${containerStyles.join('; ')}"`
          : '';
      logoContainerClass = logo.containerClass ? ` ${logo.containerClass}` : '';
    }
  }

  const specData = spec ? JSON.stringify(spec, null, 2) : null;
  const specSource = specUrl
    ? `fetch('${specUrl}').then(r => r.json())`
    : `Promise.resolve(${specData})`;

  // Process theme colors
  const themeColors = theme_?.colors || {};
  const isDarkMode = theme === 'dark';

  // Allow theme_ to override default dark mode colors
  const customThemeCSS = Object.entries(themeColors)
    .map(([key, value]) => `--flexdoc-${key}: ${value};`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    ${favicon ? `<link rel="icon" href="${favicon}">` : ''}
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {}
        }
      }
    </script>
    
    <!-- Prism.js for syntax highlighting -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    
    <style>
        :root {
            --flexdoc-primary: #3b82f6;
            --flexdoc-secondary: #10b981;
            --flexdoc-accent: #8b5cf6;
            --flexdoc-background: #ffffff;
            --flexdoc-surface: #f8fafc;
            --flexdoc-text: #1f2937;
            --flexdoc-text-secondary: #6b7280;
            --flexdoc-border: #e5e7eb;
            ${customThemeCSS}
        }
        
        .dark {
            --flexdoc-primary: #60a5fa;
            --flexdoc-secondary: #34d399;
            --flexdoc-accent: #a78bfa;
            --flexdoc-background: #111827;
            --flexdoc-surface: #1f2937;
            --flexdoc-text: #f9fafb;
            --flexdoc-text-secondary: #d1d5db;
            --flexdoc-border: #374151;
        }
        
        .flexdoc-container {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        /* Method badges - with filled backgrounds */
        .method-get { color: white; background-color: #3B82F6; border-color: #2563EB; }
        .method-post { color: white; background-color: #10B981; border-color: #059669; }
        .method-put { color: white; background-color: #F59E0B; border-color: #D97706; }
        .method-delete { color: white; background-color: #EF4444; border-color: #DC2626; }
        .method-patch { color: white; background-color: #8B5CF6; border-color: #7C3AED; }
        .method-options { color: white; background-color: #6B7280; border-color: #4B5563; }
        .method-head { color: white; background-color: #6B7280; border-color: #4B5563; }
        .method-trace { color: white; background-color: #6B7280; border-color: #4B5563; }
        
        /* Method badges - dark mode (keeping the same vibrant colors as light mode) */
        .dark .method-get { color: white; background-color: #2563EB; border-color: #1D4ED8; }
        .dark .method-post { color: white; background-color: #059669; border-color: #047857; }
        .dark .method-put { color: white; background-color: #D97706; border-color: #B45309; }
        .dark .method-delete { color: white; background-color: #DC2626; border-color: #B91C1C; }
        .dark .method-patch { color: white; background-color: #7C3AED; border-color: #6D28D9; }
        .dark .method-options { color: white; background-color: #4B5563; border-color: #374151; }
        .dark .method-head { color: white; background-color: #4B5563; border-color: #374151; }
        .dark .method-trace { color: white; background-color: #4B5563; border-color: #374151; }
        
        /* Status badges - light mode */
        .status-2xx { color: #059669; background-color: #ECFDF5; border-color: #A7F3D0; }
        .status-3xx { color: #2563EB; background-color: #EFF6FF; border-color: #BFDBFE; }
        .status-4xx { color: #D97706; background-color: #FFFBEB; border-color: #FCD34D; }
        .status-5xx { color: #DC2626; background-color: #FEF2F2; border-color: #FECACA; }
        
        /* Status badges - dark mode */
        .dark .status-2xx { color: #6EE7B7; background-color: #064E3B; border-color: #065F46; }
        .dark .status-3xx { color: #93C5FD; background-color: #1E3A8A; border-color: #1E40AF; }
        .dark .status-4xx { color: #FBBF24; background-color: #78350F; border-color: #92400E; }
        .dark .status-5xx { color: #FCA5A5; background-color: #7F1D1D; border-color: #991B1B; }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .slide-down {
            animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
            from { opacity: 0; max-height: 0; }
            to { opacity: 1; max-height: 1000px; }
        }
        
        ${customCss}
    </style>
</head>
<body class="bg-gray-50 transition-colors duration-200 ${
    theme === 'dark' ? 'dark dark:bg-gray-900' : ''
  }">
    <div id="flexdoc-app" class="flexdoc-container min-h-screen">
        <div class="flex h-screen">
            <!-- Sidebar -->
            <div id="sidebar" class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-colors duration-200">
                <!-- Header -->
                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-3 mb-4">
                        ${
                          logoUrl
                            ? `<div class="logo-container${logoContainerClass}"${logoContainerStyle}>
                                ${
                                  logoClickable
                                    ? `<a href="#" onclick="window.location.reload(true);">`
                                    : ''
                                }
                                <img src="${logoUrl}" alt="${logoAlt}" class="h-8"${logoStyle}>
                                ${logoClickable ? `</a>` : ''}
                              </div>`
                            : `
                        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <i data-lucide="file-text" class="w-4 h-4 text-white"></i>
                        </div>`
                        }
                        <div>
                            <h1 class="text-lg font-semibold text-gray-900 dark:text-white">FlexDoc</h1>
                            <p class="text-sm text-gray-500 dark:text-gray-400">API Documentation</p>
                        </div>
                    </div>
                    
                    <!-- Search -->
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"></i>
                        <input
                            type="text"
                            id="search-input"
                            placeholder="Search endpoints..."
                            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>
                </div>

                <!-- Navigation -->
                <div class="flex-1 overflow-y-auto">
                    <div class="p-4">
                        <!-- API Info -->
                        <div class="mb-6">
                            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">API Information</h3>
                            <div id="api-info" class="space-y-2">
                                <!-- Will be populated by JavaScript -->
                            </div>
                        </div>

                        <!-- Endpoints -->
                        <div>
                            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Endpoints</h3>
                            <div id="endpoints-nav">
                                <!-- Will be populated by JavaScript -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 flex flex-col">
                <div id="main-content" class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 transition-colors duration-200">
                    <!-- Will be populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <!-- Theme Toggle Button (Bottom Left Corner) -->
    <button 
        id="theme-toggle" 
        class="fixed left-4 bottom-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        aria-label="Toggle Dark Mode"
    >
        <i data-lucide="moon" class="w-5 h-5 text-gray-700 dark:text-gray-300 hidden dark:block"></i>
        <i data-lucide="sun" class="w-5 h-5 text-gray-700 dark:text-gray-300 block dark:hidden"></i>
    </button>

    <script>
        // Global state
        let currentSpec = null;
        let selectedEndpoint = null;
        let expandedTags = new Set(['default']);
        let searchTerm = '';

        // Initialize the application
        async function initFlexDoc() {
            try {
                currentSpec = await ${specSource};
                renderApp();
                setupEventListeners();
                lucide.createIcons();
            } catch (error) {
                console.error('Failed to load OpenAPI specification:', error);
                document.getElementById('main-content').innerHTML = \`
                    <div class="flex items-center justify-center h-full">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i data-lucide="alert-circle" class="w-8 h-8 text-red-600"></i>
                            </div>
                            <h2 class="text-xl font-semibold text-gray-900 mb-2">Failed to Load Specification</h2>
                            <p class="text-gray-600">Unable to load the OpenAPI specification.</p>
                        </div>
                    </div>
                \`;
                lucide.createIcons();
            }
        }

        // Render the entire application
        function renderApp() {
            renderApiInfo();
            renderEndpointsNav();
            renderMainContent();
        }

        // Render API information section
        function renderApiInfo() {
            const apiInfoEl = document.getElementById('api-info');
            const info = currentSpec.info;
            
            apiInfoEl.innerHTML = \`
                <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 class="font-medium text-gray-900 dark:text-white">\${info.title}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Version \${info.version}</p>
                </div>
                \${currentSpec.servers && currentSpec.servers.length > 0 ? \`
                <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                        <i data-lucide="server" class="w-4 h-4 text-gray-500 dark:text-gray-400"></i>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Servers</span>
                    </div>
                    \${currentSpec.servers.map(server => \`
                        <div class="text-sm text-gray-600 dark:text-gray-400">
                            <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">\${server.url}</code>
                            \${server.description ? \`<p class="mt-1">\${server.description}</p>\` : ''}
                        </div>
                    \`).join('')}
                </div>
                \` : ''}
            \`;
        }

        // Render endpoints navigation
        function renderEndpointsNav() {
            const endpointsNavEl = document.getElementById('endpoints-nav');
            const groupedEndpoints = groupEndpointsByTags();
            
            endpointsNavEl.innerHTML = Object.entries(groupedEndpoints)
                .map(([tag, endpoints]) => renderTagSection(tag, endpoints))
                .join('');
        }

        // Group endpoints by tags
        function groupEndpointsByTags() {
            const grouped = {};
            
            Object.entries(currentSpec.paths).forEach(([path, pathItem]) => {
                const methods = getHttpMethods(pathItem);
                
                methods.forEach(method => {
                    const operation = pathItem[method];
                    const tags = operation?.tags || ['default'];
                    
                    tags.forEach(tag => {
                        if (!grouped[tag]) grouped[tag] = [];
                        grouped[tag].push({ path, method, operation });
                    });
                });
            });
            
            return grouped;
        }

        // Get HTTP methods from path item
        function getHttpMethods(pathItem) {
            const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
            return methods.filter(method => pathItem[method]);
        }

        // Render tag section
        function renderTagSection(tag, endpoints) {
            const isExpanded = expandedTags.has(tag);
            const filteredEndpoints = endpoints.filter(endpoint => {
                const searchString = \`\${endpoint.method} \${endpoint.path} \${endpoint.operation?.summary || ''}\`.toLowerCase();
                return searchString.includes(searchTerm.toLowerCase());
            });
            
            if (filteredEndpoints.length === 0) return '';
            
            return \`
                <div class="mb-4">
                    <button
                        onclick="toggleTag('\${tag}')"
                        class="flex items-center gap-2 w-full text-left p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <i data-lucide="\${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-gray-500 dark:text-gray-400"></i>
                        <i data-lucide="tag" class="w-4 h-4 text-gray-500 dark:text-gray-400"></i>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-400 capitalize">
                            \${tag === 'default' ? 'General' : tag}
                        </span>
                        <span class="text-xs text-gray-500 ml-auto dark:text-gray-400">\${filteredEndpoints.length}</span>
                    </button>
                    
                    \${isExpanded ? \`
                        <div class="ml-6 mt-2 space-y-1">
                            \${filteredEndpoints.map(endpoint => renderEndpointItem(endpoint)).join('')}
                        </div>
                    \` : ''}
                </div>
            \`;
        }

        // Render individual endpoint item
        function renderEndpointItem({ path, method, operation }) {
            const isSelected = selectedEndpoint?.path === path && selectedEndpoint?.method === method;
            
            return \`
                <button
                    onclick="selectEndpoint('\${path}', '\${method}')"
                    class="w-full text-left p-2 rounded-lg transition-colors \${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }"
                >
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold px-2 py-1 rounded method-\${method}">
                            \${method.toUpperCase()}
                        </span>
                    </div>
                    <div class="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">\${path}</div>
                    \${operation?.summary ? \`
                        <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">\${operation.summary}</div>
                    \` : ''}
                </button>
            \`;
        }

        // Render main content area
        function renderMainContent() {
            const mainContentEl = document.getElementById('main-content');
            
            if (selectedEndpoint) {
                mainContentEl.innerHTML = renderEndpointDetail();
            } else {
                mainContentEl.innerHTML = renderOverview();
            }
        }

        // Render overview page
        function renderOverview() {
            const info = currentSpec.info;
            const endpointStats = calculateEndpointStats();
            
            return \`
                <div class="p-8">
                    <!-- Header -->
                    <div class="mb-8">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                <i data-lucide="file-text" class="w-6 h-6 text-white"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">\${
                                  info.title
                                }</h1>
                                <p class="text-gray-600 dark:text-gray-400">Version \${
                                  info.version
                                }</p>
                            </div>
                        </div>
                        
                        \${
                          info.description
                            ? \`
                            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-4xl">\${info.description}</p>
                        \`
                            : ''
                        }
                    </div>

                    <!-- Quick Stats -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                    <i data-lucide="file-text" class="w-5 h-5 text-blue-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Endpoints</p>
                                    <p class="text-2xl font-bold text-gray-900 dark:text-white">\${endpointStats.total}</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                    <i data-lucide="server" class="w-5 h-5 text-green-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Servers</p>
                                    <p class="text-2xl font-bold text-gray-900 dark:text-white">\${currentSpec.servers?.length || 0}</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                    <i data-lucide="tag" class="w-5 h-5 text-purple-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Tags</p>
                                    <p class="text-2xl font-bold text-gray-900 dark:text-white">\${currentSpec.tags?.length || 0}</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                    <i data-lucide="shield" class="w-5 h-5 text-orange-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Security Schemes</p>
                                    <p class="text-2xl font-bold text-gray-900 dark:text-white">
                                        \${currentSpec.components?.securitySchemes ? Object.keys(currentSpec.components.securitySchemes).length : 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Method Distribution -->
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-8">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">HTTP Methods Distribution</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            \${['get', 'post', 'put', 'delete', 'patch', 'options'].map(method => \`
                                <div class="text-center">
                                    <div class="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2 method-\${method}">
                                        <span class="text-xs font-bold">\${method.toUpperCase()}</span>
                                    </div>
                                    <p class="text-lg font-bold text-gray-900 dark:text-white">\${endpointStats[method] || 0}</p>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                </div>
            \`;
        }

        // Calculate endpoint statistics
        function calculateEndpointStats() {
            const stats = { total: 0 };
            
            Object.entries(currentSpec.paths).forEach(([path, pathItem]) => {
                const methods = getHttpMethods(pathItem);
                methods.forEach(method => {
                    stats[method] = (stats[method] || 0) + 1;
                    stats.total++;
                });
            });
            
            return stats;
        }

        // Render endpoint detail page
        function renderEndpointDetail() {
            const { path, method } = selectedEndpoint;
            const pathItem = currentSpec.paths[path];
            const operation = pathItem[method];
            
            return \`
                <div class="p-8">
                    <!-- Header -->
                    <div class="mb-8">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="text-sm font-bold px-3 py-1 rounded border method-\${method}">
                                \${method.toUpperCase()}
                            </span>
                            <code class="text-lg font-mono font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-600 px-3 py-1 rounded">
                                \${path}
                            </code>
                        </div>
                        
                        \${operation.summary ? \`
                            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">\${operation.summary}</h1>
                        \` : ''}
                        
                        \${operation.description ? \`
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">\${operation.description}</p>
                        \` : ''}
                        
                        <div class="flex items-center gap-4 mt-4">
                            \${operation.deprecated ? \`
                                <div class="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                    <i data-lucide="alert-circle" class="w-4 h-4"></i>
                                    <span class="text-sm font-medium">Deprecated</span>
                                </div>
                            \` : ''}
                            
                            \${operation.security ? \`
                                <div class="flex items-center gap-1 text-red-600 dark:text-red-400">
                                    <i data-lucide="lock" class="w-4 h-4"></i>
                                    <span class="text-sm">Authentication required</span>
                                </div>
                            \` : \`
                                <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <i data-lucide="unlock" class="w-4 h-4"></i>
                                    <span class="text-sm">No authentication required</span>
                                </div>
                            \`}
                        </div>
                    </div>

                    <!-- Parameters -->
                    \${renderParameters(operation, pathItem)}

                    <!-- Request Body -->
                    \${renderRequestBody(operation)}

                    <!-- Responses -->
                    \${renderResponses(operation)}

                    <!-- Code Examples -->
                    \${renderCodeExamples(path, method, operation)}
                </div>
            \`;
        }

        // Render parameters section
        function renderParameters(operation, pathItem) {
            const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
            if (parameters.length === 0) return '';
            
            return \`
                <div class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Parameters</h2>
                    <div class="space-y-4">
                        \${parameters.map(param => {
                            const parameter = param.$ref ? resolveReference(param.$ref) : param;
                            return \`
                                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800/30">
                                    <div class="flex items-center gap-2 mb-2">
                                        <code class="font-mono font-medium text-gray-900 dark:text-gray-100">\${parameter.name}</code>
                                        <span class="text-xs px-2 py-1 rounded \${getParameterTypeClass(parameter.in)}">
                                            \${parameter.in}
                                        </span>
                                        \${parameter.required ? \`
                                            <span class="text-xs bg-red-100 dark:bg-red-600 text-red-700 dark:text-red-300 px-2 py-1 rounded">required</span>
                                        \` : ''}
                                    </div>
                                    
                                    \${parameter.description ? \`
                                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">\${parameter.description}</p>
                                    \` : ''}
                                    
                                    \${parameter.schema ? renderSchema(parameter.schema) : ''}
                                </div>
                            \`;
                        }).join('')}
                    </div>
                </div>
            \`;
        }

        // Get parameter type CSS class
        function getParameterTypeClass(paramIn) {
            const classes = {
                path: 'bg-purple-100 text-purple-700',
                query: 'bg-blue-100 text-blue-700',
                header: 'bg-green-100 text-green-700',
                cookie: 'bg-gray-100 text-gray-700'
            };
            return classes[paramIn] || 'bg-gray-100 text-gray-700';
        }

        // Render request body section
        function renderRequestBody(operation) {
            if (!operation.requestBody) return '';
            
            const requestBody = operation.requestBody.$ref ? 
                resolveReference(operation.requestBody.$ref) : operation.requestBody;
            
            return \`
                <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 p-4">Request Body</h2>
                    <div class="space-y-4 p-4">
                        \${Object.entries(requestBody.content || {}).map(([mediaType, content]) => \`
                            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800/30">
                                <div class="flex items-center gap-2 mb-3">
                                    <code class="text-sm bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">\${mediaType}</code>
                                    \${requestBody.required ? \`
                                        <span class="text-xs bg-red-100 dark:bg-red-600 text-red-700 dark:text-red-300 px-2 py-1 rounded">required</span>
                                    \` : ''}
                                </div>
                                
                                \${content.schema ? renderSchema(content.schema) : ''}
                            </div>
                        \`).join('')}
                    </div>
                </div>
            \`;
        }

        // Render responses section
        function renderResponses(operation) {
            return \`
                <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 p-4">Responses</h2>
                    <div class="space-y-4 p-4">
                        \${Object.entries(operation.responses).map(([statusCode, response]) => {
                            const resolvedResponse = response.$ref ? resolveReference(response.$ref) : response;
                            return \`
                                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800/30">
                                    <div class="flex items-center gap-2 mb-3">
                                        <span class="text-sm font-bold px-3 py-1 rounded border \${getStatusClass(statusCode)}">
                                            \${statusCode}
                                        </span>
                                        <span class="text-sm text-gray-600 dark:text-gray-400">\${resolvedResponse.description}</span>
                                    </div>
                                    
                                    \${resolvedResponse.content ? Object.entries(resolvedResponse.content).map(([mediaType, content]) => \`
                                        <div class="mt-3">
                                            <code class="text-sm bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">\${mediaType}</code>
                                            \${content.schema ? \`<div class="mt-2">\${renderSchema(content.schema)}</div>\` : ''}
                                        </div>
                                    \`).join('') : ''}
                                </div>
                            \`;
                        }).join('')}
                    </div>
                </div>
            \`;
        }

        // Get status code CSS class
        function getStatusClass(status) {
            const code = parseInt(status);
            if (code >= 200 && code < 300) return 'status-2xx';
            if (code >= 300 && code < 400) return 'status-3xx';
            if (code >= 400 && code < 500) return 'status-4xx';
            if (code >= 500) return 'status-5xx';
            return 'text-gray-600 bg-gray-50 border-gray-200';
        }

        // Render code examples section
        function renderCodeExamples(path, method, operation) {
            const curlExample = generateCurlExample(path, method, operation);
            
            return \`
                <div class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Code Examples</h2>
                    <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        <div class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                            <span class="text-sm font-medium text-gray-300">cURL</span>
                            <button onclick="copyToClipboard(\\\`\${curlExample.replace(/\`/g, '\\\`')}\\\`)" class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                                <i data-lucide="copy" class="w-3 h-3"></i>
                                Copy
                            </button>
                        </div>
                        <div class="p-4 overflow-x-auto">
                            <pre class="text-sm text-gray-300"><code>\${curlExample}</code></pre>
                        </div>
                    </div>
                </div>
            \`;
        }

        // Generate cURL example
        function generateCurlExample(path, method, operation) {
            let curl = \`curl -X \${method.toUpperCase()} \`;
            
            const baseUrl = currentSpec.servers?.[0]?.url || 'https://api.example.com';
            curl += \`"\${baseUrl}\${path}" \\\\\`;
            curl += \`\\n  -H "Content-Type: application/json"\`;
            
            if (operation.security) {
                curl += \` \\\\\`;
                curl += \`\\n  -H "Authorization: Bearer YOUR_TOKEN"\`;
            }
            
            if (['post', 'put', 'patch'].includes(method.toLowerCase()) && operation.requestBody) {
                curl += \` \\\\\`;
                curl += \`\\n  -d '{}'\`;
            }
            
            return curl;
        }

        // Render schema
        function renderSchema(schema, level = 0) {
            if (schema.$ref) {
                const resolved = resolveReference(schema.$ref);
                return renderSchema(resolved, level);
            }

            const indent = level * 16;
            
            return \`
                <div style="margin-left: \${indent}px" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                    <div class="flex items-center gap-2 py-1">
                        <span class="text-sm text-gray-600 dark:text-gray-400">
                            \${schema.type || 'any'}
                            \${schema.format ? \` (\${schema.format})\` : ''}
                        </span>
                        \${schema.required ? \`
                            <span class="text-xs bg-red-100 dark:bg-red-600 text-red-700 dark:text-red-300 px-1 rounded">required</span>
                        \` : ''}
                        \${schema.nullable ? \`
                            <span class="text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-400 px-1 rounded">nullable</span>
                        \` : ''}
                    </div>
                    
                    \${schema.description ? \`
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">\${schema.description}</p>
                    \` : ''}
                    
                    \${schema.example !== undefined ? \`
                        <div class="mt-2">
                            <div class="bg-gray-900 rounded p-2">
                                <pre class="text-sm text-gray-300"><code>\${JSON.stringify(schema.example, null, 2)}</code></pre>
                            </div>
                        </div>
                    \` : ''}

                    \${schema.properties ? Object.entries(schema.properties).map(([propName, propSchema]) => \`
                        <div class="border-l-2 border-gray-200 dark:border-gray-700 pl-3 mt-2">
                            <div class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">\${propName}</div>
                            \${renderSchema(propSchema, level + 1)}
                        </div>
                    \`).join('') : ''}
                </div>
            \`;
        }

        // Resolve reference
        function resolveReference(ref) {
            if (!ref.startsWith('#/')) {
                throw new Error('Only local references are supported');
            }

            const path = ref.substring(2).split('/');
            let current = currentSpec;
            
            for (const segment of path) {
                if (!current[segment]) {
                    throw new Error(\`Reference not found: \${ref}\`);
                }
                current = current[segment];
            }
            
            return current;
        }

        // Event handlers
        function toggleTag(tag) {
            if (expandedTags.has(tag)) {
                expandedTags.delete(tag);
            } else {
                expandedTags.add(tag);
            }
            renderEndpointsNav();
            lucide.createIcons();
        }

        function selectEndpoint(path, method) {
            selectedEndpoint = { path, method };
            renderApp();
            lucide.createIcons();
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('Copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }

        // Setup event listeners
        function setupEventListeners() {
            const searchInput = document.getElementById('search-input');
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderEndpointsNav();
                lucide.createIcons();
            });
            
            // Theme toggle functionality
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    // Toggle dark mode class
                    document.body.classList.toggle('dark');
                    
                    // Update background colors for body
                    if (document.body.classList.contains('dark')) {
                        document.body.classList.add('bg-gray-900');
                        document.body.classList.remove('bg-gray-50');
                    } else {
                        document.body.classList.add('bg-gray-50');
                        document.body.classList.remove('bg-gray-900');
                    }
                    
                    // Re-initialize icons to update their appearance
                    lucide.createIcons();
                    
                    // Store preference in localStorage
                    localStorage.setItem('flexdoc-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
                });
            }
            
            // Check for saved theme preference
            const savedTheme = localStorage.getItem('flexdoc-theme');
            if (savedTheme === 'dark' && !document.body.classList.contains('dark')) {
                document.body.classList.add('dark', 'bg-gray-900');
                document.body.classList.remove('bg-gray-50');
            }
        }

        // Custom JavaScript
        ${customJs}

        // Initialize the application
        initFlexDoc();
    </script>
</body>
</html>`;
}

