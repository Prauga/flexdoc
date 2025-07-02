import { FlexDocOptions, LogoOptions, ThemeConfig } from './interfaces';

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
  } = options;

  // Process theme configuration
  const themeConfig: ThemeConfig = typeof theme === 'object' ? theme : {};
  const themeMode = typeof theme === 'string' ? theme : 'light';

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
  const themeColors = themeConfig?.colors || {};
  const isDarkMode = themeMode === 'dark';

  // Generate CSS variables for theme
  const cssVars = [];

  // Primary colors
  if (themeColors.primary) {
    if (themeColors.primary.main)
      cssVars.push(`--flexdoc-primary: ${themeColors.primary.main}`);
    if (themeColors.primary.light)
      cssVars.push(`--flexdoc-primary-light: ${themeColors.primary.light}`);
    if (themeColors.primary.dark)
      cssVars.push(`--flexdoc-primary-dark: ${themeColors.primary.dark}`);
  }

  // Success colors
  if (themeColors.success) {
    if (themeColors.success.main)
      cssVars.push(`--flexdoc-success: ${themeColors.success.main}`);
    if (themeColors.success.light)
      cssVars.push(`--flexdoc-success-light: ${themeColors.success.light}`);
    if (themeColors.success.dark)
      cssVars.push(`--flexdoc-success-dark: ${themeColors.success.dark}`);
  }

  // Error colors
  if (themeColors.error) {
    if (themeColors.error.main)
      cssVars.push(`--flexdoc-error: ${themeColors.error.main}`);
    if (themeColors.error.light)
      cssVars.push(`--flexdoc-error-light: ${themeColors.error.light}`);
    if (themeColors.error.dark)
      cssVars.push(`--flexdoc-error-dark: ${themeColors.error.dark}`);
  }

  // Text colors
  if (themeColors.text) {
    if (themeColors.text.primary)
      cssVars.push(`--flexdoc-text-primary: ${themeColors.text.primary}`);
    if (themeColors.text.secondary)
      cssVars.push(`--flexdoc-text-secondary: ${themeColors.text.secondary}`);
  }

  // Gray colors
  if (themeColors.gray) {
    if (themeColors.gray[50])
      cssVars.push(`--flexdoc-gray-50: ${themeColors.gray[50]}`);
    if (themeColors.gray[100])
      cssVars.push(`--flexdoc-gray-100: ${themeColors.gray[100]}`);
  }

  // Border colors
  if (themeColors.border) {
    if (themeColors.border.dark)
      cssVars.push(`--flexdoc-border-dark: ${themeColors.border.dark}`);
    if (themeColors.border.light)
      cssVars.push(`--flexdoc-border-light: ${themeColors.border.light}`);
  }

  // Typography
  if (themeConfig.typography) {
    const typography = themeConfig.typography;
    if (typography.fontSize)
      cssVars.push(`--flexdoc-font-size: ${typography.fontSize}`);
    if (typography.lineHeight)
      cssVars.push(`--flexdoc-line-height: ${typography.lineHeight}`);
    if (typography.fontFamily)
      cssVars.push(`--flexdoc-font-family: ${typography.fontFamily}`);

    if (typography.headings) {
      if (typography.headings.fontFamily)
        cssVars.push(
          `--flexdoc-headings-font-family: ${typography.headings.fontFamily}`
        );
      if (typography.headings.fontWeight)
        cssVars.push(
          `--flexdoc-headings-font-weight: ${typography.headings.fontWeight}`
        );
    }

    if (typography.code) {
      if (typography.code.fontSize)
        cssVars.push(`--flexdoc-code-font-size: ${typography.code.fontSize}`);
      if (typography.code.fontFamily)
        cssVars.push(
          `--flexdoc-code-font-family: ${typography.code.fontFamily}`
        );
      if (typography.code.lineHeight)
        cssVars.push(
          `--flexdoc-code-line-height: ${typography.code.lineHeight}`
        );
      if (typography.code.color)
        cssVars.push(`--flexdoc-code-color: ${typography.code.color}`);
      if (typography.code.backgroundColor)
        cssVars.push(`--flexdoc-code-bg: ${typography.code.backgroundColor}`);
    }
  }

  // Sidebar
  if (themeConfig.sidebar) {
    const sidebar = themeConfig.sidebar;
    if (sidebar.backgroundColor)
      cssVars.push(`--flexdoc-sidebar-bg: ${sidebar.backgroundColor}`);
    if (sidebar.textColor)
      cssVars.push(`--flexdoc-sidebar-text: ${sidebar.textColor}`);
    if (sidebar.activeTextColor)
      cssVars.push(`--flexdoc-sidebar-active: ${sidebar.activeTextColor}`);
  }

  const cssVarsString = cssVars.length > 0 ? cssVars.join(';') + ';' : '';

  // Allow theme_ to override default dark mode colors
  const customThemeCSS = Object.entries(themeColors)
    .map(([key, value]) => `--flexdoc-${key}: ${value};`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en" class="${isDarkMode ? 'dark' : ''}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${favicon ? `<link rel="icon" href="${favicon}" />` : ''}
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    ${
      themeConfig.typography?.headings?.fontFamily &&
      !themeConfig.typography.headings.fontFamily.includes('Inter')
        ? `<link href="https://fonts.googleapis.com/css2?family=${themeConfig.typography.headings.fontFamily.replace(
            / /g,
            '+'
          )}:wght@400;500;600;700&display=swap" rel="stylesheet">`
        : ''
    }
    ${
      themeConfig.typography?.fontFamily &&
      !themeConfig.typography.fontFamily.includes('Inter')
        ? `<link href="https://fonts.googleapis.com/css2?family=${themeConfig.typography.fontFamily.replace(
            / /g,
            '+'
          )}:wght@400;500;600;700&display=swap" rel="stylesheet">`
        : ''
    }
    <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.js"></script>
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
            /* Base theme variables */
            --flexdoc-primary: ${themeColors.primary?.main || '#3b82f6'};
            --flexdoc-primary-light: ${themeColors.primary?.light || '#60a5fa'};
            --flexdoc-primary-dark: ${themeColors.primary?.dark || '#2563eb'};
            
            --flexdoc-success: ${themeColors.success?.main || '#10b981'};
            --flexdoc-success-light: ${themeColors.success?.light || '#F0F9ED'};
            --flexdoc-success-dark: ${themeColors.success?.dark || '#059669'};
            
            --flexdoc-error: ${themeColors.error?.main || '#F44336'};
            --flexdoc-error-light: ${themeColors.error?.light || '#FDEDEB'};
            --flexdoc-error-dark: ${themeColors.error?.dark || '#D32F2F'};
            
            --flexdoc-text-primary: ${themeColors.text?.primary || '#111111'};
            --flexdoc-text-secondary: ${
              themeColors.text?.secondary || '#666666'
            };
            
            --flexdoc-gray-50: ${themeColors.gray?.[50] || '#F9FAFC'};
            --flexdoc-gray-100: ${themeColors.gray?.[100] || '#E7EDF4'};
            
            --flexdoc-border-dark: ${themeColors.border?.dark || '#B6C9DE'};
            --flexdoc-border-light: ${themeColors.border?.light || '#E7EDF4'};
            
            /* Typography */
            --flexdoc-font-size: ${themeConfig.typography?.fontSize || '16px'};
            --flexdoc-line-height: ${
              themeConfig.typography?.lineHeight || '1.5em'
            };
            --flexdoc-font-family: ${
              themeConfig.typography?.fontFamily ||
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            };
            
            --flexdoc-headings-font-family: ${
              themeConfig.typography?.headings?.fontFamily ||
              'Inter, sans-serif'
            };
            --flexdoc-headings-font-weight: ${
              themeConfig.typography?.headings?.fontWeight || '600'
            };
            
            --flexdoc-code-font-size: ${
              themeConfig.typography?.code?.fontSize || '14px'
            };
            --flexdoc-code-font-family: ${
              themeConfig.typography?.code?.fontFamily || 'monospace'
            };
            --flexdoc-code-line-height: ${
              themeConfig.typography?.code?.lineHeight || '1.4em'
            };
            --flexdoc-code-color: ${
              themeConfig.typography?.code?.color || '#0C4C91'
            };
            --flexdoc-code-bg: ${
              themeConfig.typography?.code?.backgroundColor || '#EFF3FF'
            };
            
            /* Sidebar */
            --flexdoc-sidebar-bg: ${
              themeConfig.sidebar?.backgroundColor || '#F9FAFC'
            };
            --flexdoc-sidebar-text: ${
              themeConfig.sidebar?.textColor || '#111111'
            };
            --flexdoc-sidebar-active: ${
              themeConfig.sidebar?.activeTextColor || '#0C4C91'
            };
            --flexdoc-sidebar-border: ${
              themeConfig.sidebar?.borderColor || '#E5E7EB'
            };
            
            /* Method badge colors */
            --flexdoc-method-text: #ffffff;
            --flexdoc-method-get-bg: ${
              themeConfig.methodColors?.get?.bg || '#3b82f6'
            };
            --flexdoc-method-get-border: ${
              themeConfig.methodColors?.get?.border || '#2563eb'
            };
            --flexdoc-method-post-bg: ${
              themeConfig.methodColors?.post?.bg || '#10b981'
            };
            --flexdoc-method-post-border: ${
              themeConfig.methodColors?.post?.border || '#059669'
            };
            
            /* Code tabs colors */
            --flexdoc-code-tab-inactive: #6b7280;
            --flexdoc-code-tab-active: #3b82f6;
            --flexdoc-code-tab-hover: #4b5563;
            --flexdoc-method-put-bg: ${
              themeConfig.methodColors?.put?.bg || '#f59e0b'
            };
            --flexdoc-method-put-border: ${
              themeConfig.methodColors?.put?.border || '#d97706'
            };
            --flexdoc-method-delete-bg: ${
              themeConfig.methodColors?.delete?.bg || '#ef4444'
            };
            --flexdoc-method-delete-border: ${
              themeConfig.methodColors?.delete?.border || '#dc2626'
            };
            --flexdoc-method-patch-bg: ${
              themeConfig.methodColors?.patch?.bg || '#8b5cf6'
            };
            --flexdoc-method-patch-border: ${
              themeConfig.methodColors?.patch?.border || '#7c3aed'
            };
            --flexdoc-method-options-bg: ${
              themeConfig.methodColors?.options?.bg || '#6b7280'
            };
            --flexdoc-method-options-border: ${
              themeConfig.methodColors?.options?.border || '#4b5563'
            };
            --flexdoc-method-head-bg: ${
              themeConfig.methodColors?.head?.bg || '#1e40af'
            };
            --flexdoc-method-head-border: ${
              themeConfig.methodColors?.head?.border || '#1e3a8a'
            };
            
            /* Legacy variables for backward compatibility */
            --flexdoc-background: #ffffff;
            --flexdoc-surface: #f8fafc;
            --flexdoc-text: var(--flexdoc-text-primary);
            --flexdoc-border: var(--flexdoc-border-light);
            ${cssVarsString}
        }
        
        .dark {
            /* Dark mode overrides */
            --flexdoc-background: #111827;
            --flexdoc-surface: #1f2937;
            --flexdoc-text-primary: #f9fafb;
            --flexdoc-text-secondary: #d1d5db;
            --flexdoc-border-light: #374151;
            --flexdoc-border: #374151;
            --flexdoc-code-bg: #111827;
            --flexdoc-code-color: #93c5fd;
            
            /* Sidebar dark mode */
            --flexdoc-sidebar-bg: ${
              themeConfig.sidebar?.backgroundColorDark || '#111827'
            };
            --flexdoc-sidebar-text: ${
              themeConfig.sidebar?.textColorDark || '#f9fafb'
            };
            --flexdoc-sidebar-active: ${
              themeConfig.sidebar?.activeTextColorDark || '#60a5fa'
            };
            --flexdoc-sidebar-border: ${
              themeConfig.sidebar?.borderColorDark || '#374151'
            };
            
            /* Only override if not explicitly set in theme config */
            ${
              !themeColors.primary?.light
                ? '--flexdoc-primary-light: #60a5fa;'
                : ''
            }
            ${
              !themeColors.primary?.dark
                ? '--flexdoc-primary-dark: #1d4ed8;'
                : ''
            }
            
            ${
              !themeColors.success?.light
                ? '--flexdoc-success-light: #064e3b;'
                : ''
            }
            ${
              !themeColors.success?.dark
                ? '--flexdoc-success-dark: #047857;'
                : ''
            }
            
            ${
              !themeColors.error?.light ? '--flexdoc-error-light: #7f1d1d;' : ''
            }
            ${!themeColors.error?.dark ? '--flexdoc-error-dark: #b91c1c;' : ''}
            
            /* Code tabs colors for dark mode */
            --flexdoc-code-tab-inactive: #9ca3af;
            --flexdoc-code-tab-active: #60a5fa;
            --flexdoc-code-tab-hover: #d1d5db;
            
            /* Method badge colors for dark mode */
            --flexdoc-method-get-bg: ${
              themeConfig.methodColors?.get?.bg || '#3b82f6'
            };
            --flexdoc-method-get-border: ${
              themeConfig.methodColors?.get?.border || '#2563eb'
            };
            --flexdoc-method-post-bg: ${
              themeConfig.methodColors?.post?.bg || '#10b981'
            };
            --flexdoc-method-post-border: ${
              themeConfig.methodColors?.post?.border || '#059669'
            };
            --flexdoc-method-put-bg: ${
              themeConfig.methodColors?.put?.bg || '#f59e0b'
            };
            --flexdoc-method-put-border: ${
              themeConfig.methodColors?.put?.border || '#d97706'
            };
            --flexdoc-method-delete-bg: ${
              themeConfig.methodColors?.delete?.bg || '#ef4444'
            };
            --flexdoc-method-delete-border: ${
              themeConfig.methodColors?.delete?.border || '#dc2626'
            };
            --flexdoc-method-patch-bg: ${
              themeConfig.methodColors?.patch?.bg || '#8b5cf6'
            };
            --flexdoc-method-patch-border: ${
              themeConfig.methodColors?.patch?.border || '#7c3aed'
            };
            --flexdoc-method-options-bg: ${
              themeConfig.methodColors?.options?.bg || '#6b7280'
            };
            --flexdoc-method-options-border: ${
              themeConfig.methodColors?.options?.border || '#4b5563'
            };
            --flexdoc-method-head-bg: ${
              themeConfig.methodColors?.head?.bg || '#1e40af'
            };
            --flexdoc-method-head-border: ${
              themeConfig.methodColors?.head?.border || '#1e3a8a'
            };
        }
        
        .flexdoc-container {
            font-family: var(--flexdoc-font-family);
            font-size: var(--flexdoc-font-size);
            line-height: var(--flexdoc-line-height);
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-family: var(--flexdoc-headings-font-family);
            font-weight: var(--flexdoc-headings-font-weight);
        }
        
        code {
            font-family: var(--flexdoc-code-font-family);
            font-size: var(--flexdoc-code-font-size);
            line-height: var(--flexdoc-code-line-height);
        }
        
        pre code {
            white-space: ${
              themeConfig.typography?.code?.wrap ? 'pre-wrap' : 'pre'
            };
        }
        
        /* Method badges - with filled backgrounds */
        .method-get { color: white; background-color: var(--method-get-bg, #3B82F6); border-color: var(--method-get-border, #2563EB); }
        .method-post { color: white; background-color: var(--method-post-bg, #10B981); border-color: var(--method-post-border, #059669); }
        .method-put { color: white; background-color: var(--method-put-bg, #F59E0B); border-color: var(--method-put-border, #D97706); }
        .method-delete { color: white; background-color: var(--method-delete-bg, #EF4444); border-color: var(--method-delete-border, #DC2626); }
        .method-patch { color: white; background-color: var(--method-patch-bg, #8B5CF6); border-color: var(--method-patch-border, #7C3AED); }
        .method-options { color: white; background-color: var(--method-options-bg, #6B7280); border-color: var(--method-options-border, #4B5563); }
        .method-head { color: white; background-color: var(--method-head-bg, #6B7280); border-color: var(--method-head-border, #4B5563); }
        .method-trace { color: white; background-color: var(--method-trace-bg, #6B7280); border-color: var(--method-trace-border, #4B5563); }
        
        /* Method badges - dark mode (keeping the same vibrant colors as light mode) */
        .dark .method-get { color: white; background-color: var(--method-get-bg-dark, #2563EB); border-color: var(--method-get-border-dark, #1D4ED8); }
        .dark .method-post { color: white; background-color: var(--method-post-bg-dark, #059669); border-color: var(--method-post-border-dark, #047857); }
        .dark .method-put { color: white; background-color: var(--method-put-bg-dark, #D97706); border-color: var(--method-put-border-dark, #B45309); }
        .dark .method-delete { color: white; background-color: var(--method-delete-bg-dark, #DC2626); border-color: var(--method-delete-border-dark, #B91C1C); }
        .dark .method-patch { color: white; background-color: var(--method-patch-bg-dark, #7C3AED); border-color: var(--method-patch-border-dark, #6D28D9); }
        .dark .method-options { color: white; background-color: var(--method-options-bg-dark, #4B5563); border-color: var(--method-options-border-dark, #374151); }
        .dark .method-head { color: white; background-color: var(--method-head-bg-dark, #4B5563); border-color: var(--method-head-border-dark, #374151); }
        .dark .method-trace { color: white; background-color: var(--method-trace-bg-dark, #4B5563); border-color: var(--method-trace-border-dark, #374151); }
        
        /* Status badges - light mode */
        .status-2xx { color: var(--status-2xx-color, #059669); background-color: var(--status-2xx-bg, #ECFDF5); border-color: var(--status-2xx-border, #A7F3D0); }
        .status-3xx { color: var(--status-3xx-color, #0369A1); background-color: var(--status-3xx-bg, #F0F9FF); border-color: var(--status-3xx-border, #BAE6FD); }
        .status-4xx { color: var(--status-4xx-color, #B45309); background-color: var(--status-4xx-bg, #FFFBEB); border-color: var(--status-4xx-border, #FCD34D); }
        .status-5xx { color: var(--status-5xx-color, #B91C1C); background-color: var(--status-5xx-bg, #FEF2F2); border-color: var(--status-5xx-border, #FECACA); }
        
        /* Status badges - dark mode */
        .dark .status-2xx { color: var(--status-2xx-color-dark, #A7F3D0); background-color: var(--status-2xx-bg-dark, #064E3B); border-color: var(--status-2xx-border-dark, #047857); }
        .dark .status-3xx { color: var(--status-3xx-color-dark, #BAE6FD); background-color: var(--status-3xx-bg-dark, #075985); border-color: var(--status-3xx-border-dark, #0369A1); }
        .dark .status-4xx { color: var(--status-4xx-color-dark, #FCD34D); background-color: var(--status-4xx-bg-dark, #78350F); border-color: var(--status-4xx-border-dark, #92400E); }
        .dark .status-5xx { color: var(--status-5xx-color-dark, #FECACA); background-color: var(--status-5xx-bg-dark, #7F1D1D); border-color: var(--status-5xx-border-dark, #991B1B); }
        
        /* Code tabs styles */
        .code-tab {
            color: var(--flexdoc-code-tab-inactive);
            transition: all 0.2s ease-in-out;
        }
        
        .code-tab:hover {
            color: var(--flexdoc-code-tab-hover);
        }
        
        .code-tab.active {
            color: var(--flexdoc-code-tab-active);
            border-color: var(--flexdoc-code-tab-active);
        }
        
        .code-panel {
            display: block;
        }
        
        .code-panel.hidden {
            display: none;
        }
        
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
<body class="transition-colors duration-200 ${
    isDarkMode ? 'dark' : ''
  }" style="background-color: var(--flexdoc-background, #f8fafc);">
    <div id="flexdoc-app" class="flexdoc-container min-h-screen">
        <div class="flex h-screen">
            <!-- Sidebar -->
            <div id="sidebar" class="w-80 flex flex-col h-full transition-colors duration-200" style="background-color: var(--flexdoc-sidebar-bg, #ffffff); border-right: 1px solid var(--flexdoc-sidebar-border, #e5e7eb); color: var(--flexdoc-sidebar-text, #111111);">
                <!-- Header -->
                <div class="p-6" style="border-bottom: 1px solid var(--flexdoc-border, #e5e7eb);">
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
                            <h1 class="text-lg font-semibold" style="color: var(--flexdoc-text-primary, #111111);">FlexDoc</h1>
                            <p class="text-sm" style="color: var(--flexdoc-text-secondary, #666666);">API Documentation</p>
                        </div>
                    </div>
                    
                    <!-- Search -->
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style="color: var(--flexdoc-text-secondary, #666666);"></i>
                        <input
                            type="text"
                            id="search-input"
                            placeholder="Search endpoints..."
                            class="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:border-transparent text-sm"
                            style="border: 1px solid var(--flexdoc-sidebar-border, #e5e7eb); background-color: var(--flexdoc-background, #ffffff); color: var(--flexdoc-text-primary, #111111);" 
                        />
                    </div>
                </div>

                <!-- Navigation -->
                <div class="flex-1 overflow-y-auto">
                    <div class="p-4">
                        <!-- API Info -->
                        <div class="mb-6">
                            <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style="color: var(--flexdoc-text-secondary, #666666);">API Information</h3>
                            <div id="api-info" class="space-y-2">
                                <!-- Will be populated by JavaScript -->
                            </div>
                        </div>

                        <!-- Endpoints -->
                        <div>
                            <h3 class="text-xs font-semibold uppercase tracking-wider mb-3" style="color: var(--flexdoc-text-secondary, #666666);">Endpoints</h3>
                            <div id="endpoints-nav">
                                <!-- Will be populated by JavaScript -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 flex flex-col">
                <div id="main-content" class="flex-1 overflow-y-auto transition-colors duration-200" style="background-color: var(--flexdoc-background, #ffffff); color: var(--flexdoc-text-primary, #111111);">
                    <!-- Will be populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <!-- Theme Toggle Button (Bottom Left Corner) -->
    <button 
        id="theme-toggle" 
        class="fixed left-4 bottom-4 z-50 p-2 rounded-md shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 transition-all duration-200"
        style="background-color: var(--flexdoc-background, #ffffff); border: 1px solid var(--flexdoc-border, #e5e7eb); color: var(--flexdoc-text-primary, #111111);"
        aria-label="Toggle Dark Mode"
    >
        <i data-lucide="moon" class="w-5 h-5 hidden dark:block"></i>
        <i data-lucide="sun" class="w-5 h-5 block dark:hidden"></i>
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
                    class="w-full text-left p-2 rounded-lg transition-colors"
                    style="\${
                        isSelected ? 
                        'background-color: var(--flexdoc-primary-light, #dbeafe); border: 1px solid var(--flexdoc-primary, #3b82f6);' : 
                        'border: 1px solid transparent;'
                    }"
                >
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold px-2 py-1 rounded" style="background-color: var(--flexdoc-method-\${method.toLowerCase()}-bg, var(--flexdoc-primary, #3b82f6)); color: var(--flexdoc-method-text, white); border: 1px solid var(--flexdoc-method-\${method.toLowerCase()}-border, var(--flexdoc-primary-dark, #2563eb));">
                            \${method.toUpperCase()}
                        </span>
                    </div>
                    <div class="text-sm font-mono break-all" style="color: var(--flexdoc-code-color, #0C4C91);">\${path}</div>
                    \${operation?.summary ? \`
                        <div class="text-xs mt-1" style="color: var(--flexdoc-text-secondary, #666666);">\${operation.summary}</div>
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
                <div class="p-8" style="background-color: var(--flexdoc-background, #f8fafc);">
                    <!-- Header -->
                    <div class="mb-8">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                <i data-lucide="file-text" class="w-6 h-6 text-white"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-bold text-gray-900 dark:text-white" style="color: var(--flexdoc-text-primary, #111111);">\${info.title}</h1>
                                <p class="text-gray-600 dark:text-gray-400">Version \${info.version}</p>
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
                                    <div class="w-16 h-12 mx-auto rounded-lg flex items-center justify-center mb-2" style="background-color: var(--flexdoc-method-\${method.toLowerCase()}-bg, var(--flexdoc-primary, #3b82f6)); color: var(--flexdoc-method-text, white); border: 1px solid var(--flexdoc-method-\${method.toLowerCase()}-border, var(--flexdoc-primary-dark, #2563eb)); padding: 0 8px;">
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
            const pythonExample = generatePythonExample(path, method, operation);
            const jsExample = generateJavaScriptExample(path, method, operation);
            const goExample = generateGoExample(path, method, operation);
            
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

        // Generate Python code example
        function generatePythonExample(path, method, operation) {
            const baseUrl = currentSpec.servers?.[0]?.url || 'https://api.example.com'; // Use server URL from OpenAPI spec
            const fullPath = path.startsWith('/') ? path : '/' + path;
            const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
            const hasParams = operation.parameters?.some(p => p.in === 'query');
            
            let code = \`import requests\n\n\`;
            
            // Add URL construction with query parameters if needed
            if (hasParams) {
                code += \`params = {\n\`;
                operation.parameters?.forEach(param => {
                    if (param.in === 'query') {
                        const exampleValue = param.example || 
                            (param.schema?.type === 'string' ? '"example"' : 
                            param.schema?.type === 'number' ? '123' : 
                            param.schema?.type === 'boolean' ? 'True' : 'None');
                        code += \`    "\${param.name}": \${exampleValue},\n\`;
                    }
                });
                code += \`}\n\`;
            }
            
            // Add request body if needed
            if (hasBody) {
                code += \`payload = {\n\`;
                if (operation.requestBody?.content?.['application/json']?.schema?.properties) {
                    const props = operation.requestBody.content['application/json'].schema.properties;
                    Object.keys(props).forEach(key => {
                        const prop = props[key];
                        const exampleValue = prop.example || 
                            (prop.type === 'string' ? '"example"' : 
                            prop.type === 'number' ? '123' : 
                            prop.type === 'boolean' ? 'True' : '{}');
                        code += \`    "\${key}": \${exampleValue},\n\`;
                    });
                } else {
                    code += \`    "key": "value"\n\`;
                }
                code += \`}\n\`;
            }
            
            // Add headers
            code += \`headers = {\n\`;
            code += \`    "Content-Type": "application/json",\n\`;
            code += \`    "Accept": "application/json"\n\`;
            code += \`}\n\`;
            
            // Add the request
            code += \`response = requests.\${method.toLowerCase()}(\n\`;
            code += \`    "\${baseUrl}\${fullPath}",\n\`;
            if (hasParams) code += \`    params=params,\n\`;
            if (hasBody) code += \`    json=payload,\n\`;
            code += \`    headers=headers\n\`;
            code += \`)\`;
            
            // Add response handling
            code += \`print(response.status_code)\n\`;
            code += \`print(response.json())\n\`;
            
            return code;
        }
        
        // Generate JavaScript code example
        function generateJavaScriptExample(path, method, operation) {
            const baseUrl = currentSpec.servers?.[0]?.url || 'https://api.example.com'; // Use server URL from OpenAPI spec
            const fullPath = path.startsWith('/') ? path : '/' + path;
            const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
            const hasParams = operation.parameters?.some(p => p.in === 'query');
            
            let code = \`// Using fetch API\n\n\`;
            
            // Add URL construction with query parameters if needed
            if (hasParams) {
                code += \`const params = new URLSearchParams({\n\`;
                operation.parameters?.forEach(param => {
                    if (param.in === 'query') {
                        const exampleValue = param.example || 
                            (param.schema?.type === 'string' ? '"example"' : 
                            param.schema?.type === 'number' ? '123' : 
                            param.schema?.type === 'boolean' ? 'true' : 'null');
                        code += \`  \${param.name}: \${exampleValue},\n\`;
                    }
                });
                code += \`});\n\n\`;
                code += \`const url = "\${baseUrl}\${fullPath}?" + params.toString();\n\`;
            } else {
                code += \`const url = "\${baseUrl}\${fullPath}";\n\`;
            }
            
            // Add request options
            code += \`const options = {\n\`;
            code += \`  method: "\${method.toUpperCase()}",\n\`;
            code += \`  headers: {\n\`;
            code += \`    \"Content-Type\": \"application/json\",\n\`;
            code += \`    \"Accept\": \"application/json\"\n\`;
            code += \`  }\n\`;
            
            // Add request body if needed
            if (hasBody) {
                code += \`  body: JSON.stringify({\n\`;
                if (operation.requestBody?.content?.['application/json']?.schema?.properties) {
                    const props = operation.requestBody.content['application/json'].schema.properties;
                    Object.keys(props).forEach(key => {
                        const prop = props[key];
                        const exampleValue = prop.example || 
                            (prop.type === 'string' ? '"example"' : 
                            prop.type === 'number' ? '123' : 
                            prop.type === 'boolean' ? 'true' : '{}');
                        code += \`    \${key}: \${exampleValue},\n\`;
                    });
                } else {
                    code += \`    key: \"value\"\n\`;
                }
                code += \`  })\n\`;
            } else {
                code += \`\n\`;
            }
            code += \`};\n\n\`;
            // Add the fetch call and response handling
            code += \`fetch(url, options)\n\`;
            code += \`  .then(response => response.json())\n\`;
            code += \`  .then(data => console.log(data))\n\`;
            code += \`  .catch(error => console.error("Error:", error));\`;
            
            return code;
        }
        
        // Generate Go code example
        function generateGoExample(path, method, operation) {
            const baseUrl = currentSpec.servers?.[0]?.url || 'https://api.example.com'; // Use server URL from OpenAPI spec
            const fullPath = path.startsWith('/') ? path : '/' + path;
            const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
            const hasParams = operation.parameters?.some(p => p.in === 'query');
            
            let code = \`package main\n\n\`;
            code += \`import (\n\`;
            code += \`\t"fmt"\n\`;
            code += \`\t"io/ioutil"\n\`;
            code += \`\t"net/http"\n\`;

            if (hasBody) code += \`\t"bytes"\n\`;
            if (hasParams) code += \`\t"net/url"\n\`;
            code += \`\t"encoding/json"\n\`;
            code += \`)\n\`;
            
            code += \`func main() {\n\`;
            
            // Add URL construction with query parameters if needed
            if (hasParams) {
                code += \`// Create URL with query parameters\n\`;
                code += \`baseURL := "\${baseUrl}\${fullPath}"\n\`;
                code += \`params := url.Values{}\n\`;
                operation.parameters?.forEach(param => {
                    if (param.in === 'query') {
                        const exampleValue = param.example || 
                            (param.schema?.type === 'string' ? '"example"' : 
                            param.schema?.type === 'number' ? '123' : 
                            param.schema?.type === 'boolean' ? 'true' : 'nil');
                        code += \`\tparams.Add("\${param.name}", \${exampleValue})\n\`;
                    }
                });
                code += \`\trequestURL := baseURL + "?" + params.Encode()\n\`;
            } else {
                code += \`\trequestURL := "\${baseUrl}\${fullPath}\n\`;
            }
            
            // Add request body if needed
            if (hasBody) {
                code += \`// Create request body\n\`;

                code += \`\tpayload := RequestBody{\n\`;
                if (operation.requestBody?.content?.['application/json']?.schema?.properties) {
                    const props = operation.requestBody.content['application/json'].schema.properties;
                    Object.keys(props).forEach(key => {
                        const prop = props[key];
                        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
                        const exampleValue = prop.example || 
                            (prop.type === 'string' ? '"example"' : 
                            prop.type === 'number' || prop.type === 'integer' ? '123' : 
                            prop.type === 'boolean' ? 'true' : 'nil');
                        code += \`\t\t\${pascalKey}: \${exampleValue},\n\`;
                    });
                } else {
                    code += \`\t\tKey: "value",\n\`;
                }
                code += \`\t}\n\n\`;
                
                code += \`\tjsonPayload, err := json.Marshal(payload)\n\`;
                code += \`\tif err != nil {\n\`;
                code += \`\t\tfmt.Println("Error creating JSON payload:", err)\n\`;
                code += \`\t\treturn\n\`;
                code += \`\t}\n\n\`;
                
                code += \`\treq, err := http.NewRequest("\${method.toUpperCase()}", requestURL, bytes.NewBuffer(jsonPayload))\n\`;
            } else {
                code += \`\treq, err := http.NewRequest("\${method.toUpperCase()}", requestURL, nil)\n\`;
            }
            
            // Add headers and error handling
            code += \`\tif err != nil {\n\`;
            code += \`\t\tfmt.Println("Error creating request:", err)\n\`;
            code += \`\t\treturn\n\`;
            code += \`\t}\n\n\`;
            
            code += \`\t// Add headers\n\`;
            code += \`\treq.Header.Set("Content-Type", "application/json")\n\`;
            code += \`\treq.Header.Set("Accept", "application/json")\n\n\`;
            
            // Send request and handle response
            code += \`\tclient := &http.Client{}\n\`;
            code += \`\tresp, err := client.Do(req)\n\`;
            code += \`\tif err != nil {\n\`;
            code += \`\t\tfmt.Println("Error sending request:", err)\n\`;
            code += \`\t\treturn\n\`;
            code += \`\t}\n\`;
            
            code += \`\tdefer resp.Body.Close()\n\`;
            
            code += \`\t// Read and print response\n\`;
            code += \`\tfmt.Println("Response Status:", resp.Status)\n\`;
            code += \`\tbody, err := ioutil.ReadAll(resp.Body)\n\`;
            code += \`\tif err != nil {\n\`;
            code += \`\t\tfmt.Println("Error reading response:", err)\n\`;
            code += \`\t\treturn\n\`;
            code += \`\t}\n\`;
            code += \`\tfmt.Println(string(body))\n\`;
            code += \`}\n\`;

            code += \`\tfmt.Println(string(body))\n\`;
            code += \`}\n\`;
            
            return code;
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
                    document.documentElement.classList.toggle('dark');
                    document.body.classList.toggle('dark');
                    
                    // Apply CSS variables for the current theme
                    const isDarkMode = document.documentElement.classList.contains('dark');
                    
                    // Update theme toggle button appearance
                    if (isDarkMode) {
                        themeToggle.style.backgroundColor = 'var(--flexdoc-surface, #1f2937)';
                        themeToggle.style.borderColor = 'var(--flexdoc-border, #374151)';
                    } else {
                        themeToggle.style.backgroundColor = 'var(--flexdoc-background, #ffffff)';
                        themeToggle.style.borderColor = 'var(--flexdoc-border, #e5e7eb)';
                    }
                    
                    // Re-initialize icons to update their appearance
                    lucide.createIcons();
                    
                    // Store preference in localStorage
                    localStorage.setItem('flexdoc-theme', isDarkMode ? 'dark' : 'light');
                });
            }
            
            // Check for saved theme preference
            const savedTheme = localStorage.getItem('flexdoc-theme');
            if (savedTheme === 'dark' && !document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.add('dark');
                document.body.classList.add('dark');
                
                // Update theme toggle button appearance for dark mode
                if (themeToggle) {
                    themeToggle.style.backgroundColor = 'var(--flexdoc-surface, #1f2937)';
                    themeToggle.style.borderColor = 'var(--flexdoc-border, #374151)';
                }
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

