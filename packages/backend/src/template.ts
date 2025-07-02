import { FlexDocOptions, LogoOptions, ThemeConfig } from './interfaces';
import * as nunjucks from 'nunjucks';
import * as path from 'path';
import * as fs from 'fs';

// Configure Nunjucks
const templatesPath = path.join(__dirname, 'templates');
// Create templates directory if it doesn't exist
if (!fs.existsSync(templatesPath)) {
  fs.mkdirSync(templatesPath, { recursive: true });
}
const nunjucksEnv = nunjucks.configure(templatesPath, {
  autoescape: true,
  trimBlocks: true,
  lstripBlocks: true,
});

// Add filters for Nunjucks
nunjucksEnv.addFilter('json', function (obj) {
  return JSON.stringify(obj);
});

// Add string transformation filters
nunjucksEnv.addFilter('upper', function (str) {
  return str.toUpperCase();
});

nunjucksEnv.addFilter('lower', function (str) {
  return str.toLowerCase();
});

// Define OpenAPI spec interfaces for better type safety
interface OpenAPISpec {
  paths?: Record<string, PathItem>;
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  components?: {
    securitySchemes?: Record<string, any>;
    schemas?: Record<string, any>;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: Parameter[];
  [key: string]: Operation | Parameter[] | undefined;
}

interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

interface Parameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: any;
  $ref?: string;
}

interface RequestBody {
  description?: string;
  content?: Record<string, MediaType>;
  required?: boolean;
}

interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: any;
  example?: any;
}

export function generateFlexDocHTML(
  spec: OpenAPISpec | null,
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

  // Organize paths by tags
  const taggedPaths: Record<
    string,
    Record<string, Record<string, Operation>>
  > = {};

  if (spec) {
    const paths = spec['paths'] || {};

    for (const path in paths) {
      const pathItem = paths[path];

      for (const method in pathItem) {
        if (
          ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(
            method
          )
        ) {
          const operation = pathItem[method] as Operation;
          const tags = operation.tags || ['default'];

          for (const tag of tags) {
            if (!taggedPaths[tag]) {
              taggedPaths[tag] = {};
            }

            if (!taggedPaths[tag][path]) {
              taggedPaths[tag][path] = {};
            }

            taggedPaths[tag][path][method] = operation;
          }
        }
      }
    }
  }

  // Define method colors for UI
  const methodColors = {
    get: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    post: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    put: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    patch:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    options: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    head: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  };

  // Helper functions for templates
  nunjucksEnv.addGlobal(
    'getOperationId',
    (path: string, method: string, operation: Operation) => {
      return (
        operation.operationId ||
        `${method}-${path.replace(/[^a-zA-Z0-9]/g, '-')}`
      );
    }
  );

  nunjucksEnv.addGlobal('getStatusCodeClass', (statusCode: string) => {
    const code = parseInt(statusCode, 10);
    if (code >= 200 && code < 300) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (code >= 300 && code < 400) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    } else if (code >= 400 && code < 500) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    } else {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
  });

  nunjucksEnv.addGlobal('getStatusText', (statusCode: string) => {
    const statusTexts: Record<string, string> = {
      '200': 'OK',
      '201': 'Created',
      '204': 'No Content',
      '400': 'Bad Request',
      '401': 'Unauthorized',
      '403': 'Forbidden',
      '404': 'Not Found',
      '500': 'Internal Server Error',
    };
    return statusTexts[statusCode] || '';
  });

  nunjucksEnv.addGlobal('renderSchema', (schema: any) => {
    // Render schema as HTML instead of raw JSON
    function renderSchemaAsHTML(schema: any, indent = 0): string {
      if (!schema) return '<span class="text-gray-400">null</span>';

      // Handle $ref
      if (schema.$ref) {
        const refSchema = resolveSchemaRef(schema.$ref);
        if (refSchema) {
          return renderSchemaAsHTML(refSchema, indent);
        }
        return `<span class="text-red-500">Could not resolve reference: ${schema.$ref}</span>`;
      }

      // Handle different types
      if (schema.type === 'object' || (!schema.type && schema.properties)) {
        let html = '<div class="pl-4">';

        if (schema.properties) {
          const properties = Object.entries(schema.properties);
          properties.forEach(([propName, propSchema]: [string, any], index) => {
            const isRequired =
              schema.required && schema.required.includes(propName);
            const requiredBadge = isRequired
              ? '<span class="text-red-500 ml-1">*</span>'
              : '';

            html += `<div class="mb-2">
              <span class="font-semibold text-blue-600 dark:text-blue-400">${propName}</span>${requiredBadge}: `;

            html += renderSchemaAsHTML(propSchema, indent + 2);

            if (propSchema.description) {
              html += `<span class="text-gray-500 ml-2">// ${propSchema.description}</span>`;
            }

            html += '</div>';
          });
        }

        html += '</div>';
        return html;
      } else if (schema.type === 'array') {
        return `<span class="text-purple-600 dark:text-purple-400">Array of:</span> ${renderSchemaAsHTML(
          schema.items,
          indent
        )}`;
      } else if (schema.enum) {
        return `<span class="text-green-600 dark:text-green-400">${
          schema.type || 'enum'
        }</span> <span class="text-gray-500">(${schema.enum
          .map((e: any) => JSON.stringify(e))
          .join(' | ')})</span>`;
      } else {
        let typeText = schema.type || 'any';
        let formatText = schema.format ? ` (${schema.format})` : '';
        return `<span class="text-green-600 dark:text-green-400">${typeText}${formatText}</span>`;
      }
    }

    return renderSchemaAsHTML(schema);
  });

  nunjucksEnv.addGlobal('renderExample', (example: any) => {
    return JSON.stringify(example, null, 2);
  });

  // Generate code examples for each endpoint
  const baseUrl = spec?.servers?.[0]?.url || 'https://api.example.com';

  // Code example rendering functions
  function renderCodeExamples(
    path: string,
    method: string,
    operation: Operation
  ) {
    return {
      curl: renderCurlExample(path, method, operation, baseUrl),
      python: renderPythonExample(path, method, operation, baseUrl),
      javascript: renderJavaScriptExample(path, method, operation, baseUrl),
      go: renderGoExample(path, method, operation, baseUrl),
    };
  }

  function renderCurlExample(
    path: string,
    method: string,
    operation: Operation,
    baseUrl: string
  ) {
    // Format path parameters
    let url = `${baseUrl}${path}`;
    const params = operation.parameters?.filter((p) => p.in === 'path') || [];

    // Replace path parameters with values
    params.forEach((param) => {
      const paramName = param.name;
      url = url.replace(`{${paramName}}`, `${paramName}_value`);
    });

    // Add query parameters if GET request
    const queryParams =
      operation.parameters?.filter((p) => p.in === 'query') || [];
    if (method.toLowerCase() === 'get' && queryParams.length > 0) {
      url +=
        '?' + queryParams.map((p) => `${p.name}=${p.name}_value`).join('&');
    }

    // Build headers
    let headers = 'Content-Type: application/json';

    // Build request body for non-GET requests
    let body = '';
    if (
      method.toLowerCase() !== 'get' &&
      operation.requestBody?.content?.['application/json']
    ) {
      try {
        // Generate example body from schema
        const schema = operation.requestBody.content['application/json'].schema;

        if (!schema) {
          body = ` \\
  -d '{ "example": "No schema available" }'`;
          return `curl -X ${method.toUpperCase()} \\
  "${url}" \\
  -H "${headers}"${body}`;
        }

        const exampleBody = generateExampleFromSchema(schema);

        // Format the JSON with proper escaping for cURL
        const jsonString = JSON.stringify(exampleBody, null, 2);
        // Replace quotes and format for cURL
        const escapedJson = jsonString
          .replace(/"/g, '\\"') // Escape quotes for shell
          .replace(/\n/g, '\\n');

        body = ` \\
  -d '${escapedJson}'`;
      } catch (error) {
        console.error('Error generating request body:', error);
        body = ` \\
  -d '{ "error": "Failed to generate example" }'`;
      }
    }

    return `curl -X ${method.toUpperCase()} \\
  "${url}" \\
  -H "${headers}"${body}`;
  }

  // Helper function to resolve schema references
  function resolveSchemaRef(ref: string): any {
    if (!ref.startsWith('#/')) {
      return null;
    }

    // Parse the reference path
    const path = ref.substring(2).split('/');
    let current: any = spec;

    // Navigate through the path to find the referenced schema
    for (const segment of path) {
      if (current && current[segment]) {
        current = current[segment];
      } else {
        console.log(
          'Could not resolve reference:',
          ref,
          'at segment:',
          segment
        );
        return null;
      }
    }

    return current;
  }

  // Helper function to generate example values from schema
  function generateExampleFromSchema(schema: any): any {
    if (!schema) return null;

    // Handle $ref
    if (schema.$ref) {
      const refSchema = resolveSchemaRef(schema.$ref);
      if (refSchema) {
        return generateExampleFromSchema(refSchema);
      }
      return { example: 'value' };
    }

    // Handle different types
    switch (schema.type) {
      case 'object':
        const obj: Record<string, any> = {};
        if (schema.properties) {
          for (const propName in schema.properties) {
            obj[propName] = generateExampleFromSchema(
              schema.properties[propName]
            );
          }
        }
        return obj;

      case 'array':
        if (schema.items) {
          return [generateExampleFromSchema(schema.items)];
        }
        return [];

      case 'string':
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0];
        }
        if (schema.format === 'date-time') return '2023-01-01T00:00:00Z';
        if (schema.format === 'date') return '2023-01-01';
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uuid')
          return '00000000-0000-0000-0000-000000000000';
        return 'string';

      case 'number':
      case 'integer':
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0];
        }
        return 0;

      case 'boolean':
        return false;

      default:
        return null;
    }
  }

  function renderPythonExample(
    path: string,
    method: string,
    operation: Operation,
    baseUrl: string
  ) {
    // Format path parameters
    let url = `${baseUrl}${path}`;
    const params = operation.parameters?.filter((p) => p.in === 'path') || [];

    // Replace path parameters with values
    params.forEach((param) => {
      const paramName = param.name;
      url = url.replace(`{${paramName}}`, `${paramName}_value`);
    });

    // Add query parameters if GET request
    const queryParams =
      operation.parameters?.filter((p) => p.in === 'query') || [];
    let queryParamsCode = '';
    if (queryParams.length > 0) {
      queryParamsCode = `params = {\n    ${queryParams
        .map((p) => `"${p.name}": "${p.name}_value"`)
        .join(',\n    ')}\n}`;
    }

    // Build request body for non-GET requests
    let bodyCode = '';
    if (
      method.toLowerCase() !== 'get' &&
      operation.requestBody?.content?.['application/json']
    ) {
      // Generate example body from schema
      const schema = operation.requestBody.content['application/json'].schema;
      const exampleBody = generateExampleFromSchema(schema);

      // Format the JSON with proper escaping for Python
      const jsonStr = JSON.stringify(exampleBody, null, 4)
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/\n/g, '\n    '); // Format newlines for readability

      bodyCode = `payload = ${jsonStr}`;
    }

    return `import requests

${queryParamsCode ? queryParamsCode + '\n\n' : ''}${
      bodyCode ? bodyCode + '\n\n' : ''
    }headers = {\n    "Content-Type": "application/json"\n}

response = requests.${method.toLowerCase()}("${url}"${
      queryParams.length > 0 ? ', params=params' : ''
    }${bodyCode ? ', json=payload' : ''}, headers=headers)

print(response.json())`;
  }

  function renderJavaScriptExample(
    path: string,
    method: string,
    operation: Operation,
    baseUrl: string
  ) {
    // Format path parameters
    let url = `${baseUrl}${path}`;
    const params = operation.parameters?.filter((p) => p.in === 'path') || [];

    // Replace path parameters with values
    params.forEach((param) => {
      const paramName = param.name;
      url = url.replace(`{${paramName}}`, `${paramName}_value`);
    });

    // Add query parameters if GET request
    const queryParams =
      operation.parameters?.filter((p) => p.in === 'query') || [];
    let queryParamsCode = '';
    if (queryParams.length > 0) {
      const queryString = queryParams
        .map((p) => `${p.name}=\${${p.name}Value}`)
        .join('&');
      queryParamsCode = `const ${queryParams
        .map((p) => `${p.name}Value = "${p.name}_value"`)
        .join(';\n')};
\nconst queryString = "${queryString}";
url = \`${url}?\${queryString}\`;`;
    }

    // Build request body for non-GET requests
    let bodyCode = '';
    if (
      method.toLowerCase() !== 'get' &&
      operation.requestBody?.content?.['application/json']
    ) {
      // Generate example body from schema
      const schema = operation.requestBody.content['application/json'].schema;
      const exampleBody = generateExampleFromSchema(schema);

      // Format the JSON with proper escaping for JavaScript
      const jsonStr = JSON.stringify(exampleBody, null, 2)
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/\n/g, '\n  '); // Format newlines for readability

      bodyCode = `const payload = ${jsonStr};`;
    }

    return `// Using fetch API\nasync function callApi() {\n  let url = "${url}";
  ${queryParamsCode ? queryParamsCode + '\n\n  ' : ''}${
      bodyCode ? bodyCode + '\n\n  ' : ''
    }const options = {\n    method: "${method.toUpperCase()}",\n    headers: {\n      "Content-Type": "application/json"\n    }${
      bodyCode ? ',\n    body: JSON.stringify(payload)' : ''
    }\n  };\n\n  try {\n    const response = await fetch(url, options);\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.error("Error:", error);\n  }\n}\n\ncallApi();`;
  }

  function renderGoExample(
    path: string,
    method: string,
    operation: Operation,
    baseUrl: string
  ) {
    // Format path parameters
    let url = `${baseUrl}${path}`;
    const params = operation.parameters?.filter((p) => p.in === 'path') || [];

    // Replace path parameters with values
    params.forEach((param) => {
      const paramName = param.name;
      url = url.replace(`{${paramName}}`, `${paramName}_value`);
    });

    // Add query parameters if GET request
    const queryParams =
      operation.parameters?.filter((p) => p.in === 'query') || [];
    let queryParamsCode = '';
    if (queryParams.length > 0) {
      queryParamsCode = `
	// Add query parameters
	q := req.URL.Query()
	${queryParams.map((p) => `q.Add("${p.name}", "${p.name}_value")`).join('\n\t')}
	req.URL.RawQuery = q.Encode()`;
    }

    // Build request body for non-GET requests
    let bodyCode = '';
    let bodyImport = '';
    if (
      method.toLowerCase() !== 'get' &&
      operation.requestBody?.content?.['application/json']
    ) {
      // Generate example body from schema
      const schema = operation.requestBody.content['application/json'].schema;
      const exampleBody = generateExampleFromSchema(schema);

      // Convert example body to Go map syntax
      function convertToGoMap(obj: any, indent = '\t'): string {
        if (obj === null) return 'nil';

        if (Array.isArray(obj)) {
          if (obj.length === 0) return '[]interface{}{}';

          const items = obj
            .map((item) => {
              if (typeof item === 'object' && item !== null) {
                return convertToGoMap(item, indent + '\t');
              } else if (typeof item === 'string') {
                return `"${item}"`;
              } else {
                return `${item}`;
              }
            })
            .join(',\n' + indent + '\t');

          return `[]interface{}{\n${indent}\t${items}\n${indent}}`;
        }

        if (typeof obj === 'object') {
          const entries = Object.entries(obj)
            .map(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                return `"${key}": ${convertToGoMap(value, indent + '\t')}`;
              } else if (typeof value === 'string') {
                return `"${key}": "${value}"`;
              } else {
                return `"${key}": ${value}`;
              }
            })
            .join(',\n' + indent + '\t');

          return `map[string]interface{}{\n${indent}\t${entries}\n${indent}}`;
        }

        return String(obj);
      }

      const goMapStr = convertToGoMap(exampleBody);
      bodyImport = '\n\t"bytes"';
      bodyCode = `
	// Create request body
	payload := ${goMapStr}
	
	body, err := json.Marshal(payload)
	if err != nil {
		log.Fatalf("Error creating request body: %v", err)
	}
	
	req, err = http.NewRequest("${method.toUpperCase()}", "${url}", bytes.NewBuffer(body))`;
    } else {
      bodyCode = `
	req, err := http.NewRequest("${method.toUpperCase()}", "${url}", nil)`;
    }

    return `package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"${bodyImport}
)

func main() {${bodyCode}
	if err != nil {
		log.Fatalf("Error creating request: %v", err)
	}${queryParamsCode}
	
	// Add headers
	req.Header.Set("Content-Type", "application/json")
	
	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error sending request: %v", err)
	}
	defer resp.Body.Close()
	
	// Read response
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response: %v", err)
	}
	
	fmt.Println(string(body))
}`;
  }

  // Helper function to get operation ID
  function getOperationId(
    path: string,
    method: string,
    operation: Operation
  ): string {
    return (
      operation.operationId ||
      `${method}-${path.replace(/[{}]/g, '').replace(/\//g, '-')}`
    );
  }

  // Count methods for statistics
  const methodCounts = {
    get: 0,
    post: 0,
    put: 0,
    delete: 0,
    patch: 0,
    options: 0,
    head: 0,
  };

  // Pre-count methods
  if (spec && spec.paths) {
    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      for (const method in pathItem) {
        if (
          ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(
            method
          )
        ) {
          methodCounts[method as keyof typeof methodCounts]++;
        }
      }
    }
  }

  // Function to render schema as HTML for better visualization
  function renderSchema(schema: any): string {
    if (!schema) return '<span class="text-gray-500">null</span>';

    // Helper function to resolve references
    function resolveRef(ref: string): any {
      if (!ref.startsWith('#/components/schemas/')) {
        return { $ref: ref }; // Can't resolve external refs
      }

      const schemaName = ref.replace('#/components/schemas/', '');
      if (spec?.components?.schemas && spec.components.schemas[schemaName]) {
        return spec.components.schemas[schemaName];
      }

      return { $ref: ref }; // Reference not found
    }

    // Deep clone to avoid modifying the original
    const clonedSchema = JSON.parse(JSON.stringify(schema));

    // Process schema to resolve references
    function processSchema(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj;

      // Handle direct reference
      if (obj.$ref) {
        const resolved = resolveRef(obj.$ref);
        // Keep track of the original reference
        return { ...processSchema(resolved), originalRef: obj.$ref };
      }

      // Handle array items with references
      if (obj.type === 'array' && obj.items) {
        obj.items = processSchema(obj.items);
        return obj;
      }

      // Handle properties with references
      if (obj.properties) {
        Object.keys(obj.properties).forEach((key) => {
          obj.properties[key] = processSchema(obj.properties[key]);
        });
      }

      // Handle additional properties
      if (
        obj.additionalProperties &&
        typeof obj.additionalProperties === 'object'
      ) {
        obj.additionalProperties = processSchema(obj.additionalProperties);
      }

      return obj;
    }

    const processed = processSchema(clonedSchema);

    // Generate HTML representation
    function generateSchemaHTML(
      schema: any,
      level = 0,
      isArrayItem = false
    ): string {
      if (!schema) return '<span class="text-gray-500">null</span>';

      const indent = '  '.repeat(level);
      let html = '';

      // We're no longer showing the reference since we're displaying the full schema

      // Handle different schema types
      if (schema.type === 'object') {
        if (schema.properties) {
          html += '<div class="schema-object">';
          if (!isArrayItem) {
            html += `<div class="text-blue-600 font-semibold mb-1">Object</div>`;
          }
          html += '<ul class="pl-4 space-y-2">';

          for (const propName in schema.properties) {
            const prop = schema.properties[propName];
            const required =
              schema.required && schema.required.includes(propName);

            html += '<li>';
            html += `<div><span class="font-mono font-medium">${propName}</span>`;
            if (required) {
              html +=
                ' <span class="text-red-500 text-xs font-semibold">required</span>';
            }
            html += `</div>`;

            // Property type
            html += `<div class="text-sm">`;
            if (prop.type) {
              html += `<span class="text-green-600">${prop.type}</span>`;
              if (prop.format) {
                html += ` <span class="text-gray-500">(${prop.format})</span>`;
              }
            }
            html += '</div>';

            // Description
            if (prop.description) {
              html += `<div class="text-sm text-gray-600">${prop.description}</div>`;
            }

            // Nested schema
            if (
              (prop.type === 'object' && prop.properties) ||
              (prop.type === 'array' && prop.items)
            ) {
              html += generateSchemaHTML(prop, level + 1);
            }

            html += '</li>';
          }

          html += '</ul></div>';
        } else {
          html += '<div class="text-blue-600 font-semibold">Object</div>';
        }
      } else if (schema.type === 'array') {
        html += '<div class="schema-array">';
        html += `<div class="text-blue-600 font-semibold mb-1">Array of:</div>`;
        html += generateSchemaHTML(schema.items, level + 1, true);
        html += '</div>';
      } else {
        // Simple types
        html += `<div class="text-green-600">${schema.type || 'unknown'}</div>`;
        if (schema.format) {
          html += ` <span class="text-gray-500">(${schema.format})</span>`;
        }
        if (schema.description) {
          html += `<div class="text-sm text-gray-600">${schema.description}</div>`;
        }
      }

      return html;
    }

    // For JSON copy functionality, keep the JSON version available
    const jsonString = JSON.stringify(processed, null, 2);

    // Return HTML representation
    return generateSchemaHTML(processed);
  }

  // Function to render examples
  function renderExample(example: any): string {
    if (!example) return 'null';
    return JSON.stringify(example, null, 2);
  }

  // Render the HTML using Nunjucks templates
  return nunjucksEnv.render('content.njk', {
    title,
    description,
    favicon,
    logo: logoUrl,
    logoAlt,
    logoStyle,
    logoContainerStyle,
    logoContainerClass,
    logoClickable,
    cssVars,
    cssVarsString,
    customCss,
    customJs,
    customThemeCSS,
    isDarkMode,
    currentSpec: spec,
    taggedPaths,
    methodColors,
    specUrl,
    baseUrl,
    methodCounts,
    getOperationId,
    renderCodeExamples,
    renderCurlExample,
    renderPythonExample,
    renderJavaScriptExample,
    renderGoExample,
    renderSchema,
    renderExample,
  });
}

