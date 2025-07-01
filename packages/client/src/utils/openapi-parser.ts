import * as yaml from 'js-yaml';
import { OpenAPISpec } from '../types/openapi';

export class OpenAPIParser {
  static async parseSpec(input: string | object): Promise<OpenAPISpec> {
    let spec: any;

    if (typeof input === 'string') {
      // Trim the input string to remove any leading/trailing whitespace
      const trimmedInput = input.trim();

      try {
        // Try parsing as JSON first
        spec = JSON.parse(trimmedInput);
      } catch {
        try {
          // Try parsing as YAML
          spec = yaml.load(trimmedInput);
        } catch (error) {
          // If both JSON and YAML parsing fail, throw an error
          throw new Error('Invalid OpenAPI specification format');
        }
      }
    } else {
      spec = input;
    }

    // Validate basic structure
    if (!spec.openapi || !spec.info || !spec.paths) {
      throw new Error('Invalid OpenAPI specification: missing required fields');
    }

    return spec as OpenAPISpec;
  }

  static getHttpMethods(pathItem: any): string[] {
    const methods = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'options',
      'head',
      'trace',
    ];
    return methods.filter((method) => pathItem[method]);
  }

  static getMethodColor(method: string): string {
    const colors: { [key: string]: string } = {
      get: 'text-blue-600 bg-blue-50 border-blue-200',
      post: 'text-green-600 bg-green-50 border-green-200',
      put: 'text-orange-600 bg-orange-50 border-orange-200',
      delete: 'text-red-600 bg-red-50 border-red-200',
      patch: 'text-purple-600 bg-purple-50 border-purple-200',
      options: 'text-gray-600 bg-gray-50 border-gray-200',
      head: 'text-gray-600 bg-gray-50 border-gray-200',
      trace: 'text-gray-600 bg-gray-50 border-gray-200',
    };
    return (
      colors[method.toLowerCase()] || 'text-gray-600 bg-gray-50 border-gray-200'
    );
  }

  static resolveReference(spec: OpenAPISpec, ref: string): any {
    if (!ref.startsWith('#/')) {
      throw new Error('Only local references are supported');
    }

    const path = ref.substring(2).split('/');
    let current: any = spec;

    for (const segment of path) {
      if (!current[segment]) {
        throw new Error(`Reference not found: ${ref}`);
      }
      current = current[segment];
    }

    return current;
  }

  static isReference(obj: any): boolean {
    if (obj === null || obj === undefined) {
      return false;
    }
    return typeof obj === 'object' && '$ref' in obj;
  }
}

