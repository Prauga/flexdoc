import type { OpenAPISpec, PathItem, Reference } from '../types/openapi';
import { OpenAPIParser as CoreOpenAPIParser } from '../../../../core/dist/openapi-parser.js';

export class OpenAPIParser {
  static async parseSpec(input: string | object): Promise<OpenAPISpec> {
    return CoreOpenAPIParser.parseSpec(input) as Promise<OpenAPISpec>;
  }

  static getHttpMethods(pathItem: PathItem): string[] {
    return CoreOpenAPIParser.getHttpMethods(pathItem);
  }

  static getMethodColor(method: string, theme?: 'light' | 'dark'): string {
    const lightColors: { [key: string]: string } = {
      get: 'text-blue-600 bg-blue-50 border-blue-200', post: 'text-green-600 bg-green-50 border-green-200',
      put: 'text-orange-600 bg-orange-50 border-orange-200', delete: 'text-red-600 bg-red-50 border-red-200',
      patch: 'text-purple-600 bg-purple-50 border-purple-200', options: 'text-gray-600 bg-gray-50 border-gray-200',
      head: 'text-gray-600 bg-gray-50 border-gray-200', trace: 'text-gray-600 bg-gray-50 border-gray-200',
    };
    const darkColors: { [key: string]: string } = {
      get: 'text-blue-300 bg-blue-900/30 border-blue-700', post: 'text-green-300 bg-green-900/30 border-green-700',
      put: 'text-orange-300 bg-orange-900/30 border-orange-700', delete: 'text-red-300 bg-red-900/30 border-red-700',
      patch: 'text-purple-300 bg-purple-900/30 border-purple-700', options: 'text-cyan-100 bg-cyan-800/50 border-cyan-500',
      head: 'text-gray-300 bg-gray-700/50 border-gray-600', trace: 'text-gray-300 bg-gray-700/50 border-gray-600',
    };
    const colors = theme === 'dark' ? darkColors : lightColors;
    const defaultColor = theme === 'dark' ? 'text-gray-300 bg-gray-700/50 border-gray-600' : 'text-gray-600 bg-gray-50 border-gray-200';
    return colors[method.toLowerCase()] || defaultColor;
  }

  static decodePointerToken(token: string): string { return CoreOpenAPIParser.decodePointerToken(token); }
  static encodePointerToken(token: string): string { return CoreOpenAPIParser.encodePointerToken(token); }
  static resolveReference<T = unknown>(spec: OpenAPISpec | Record<string, unknown>, ref: string): T {
    return CoreOpenAPIParser.resolveReference(spec, ref) as T;
  }
  static isReference(obj: unknown): obj is Reference { return CoreOpenAPIParser.isReference(obj); }
}
