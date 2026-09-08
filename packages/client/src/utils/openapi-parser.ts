import type { OpenAPISpec, PathItem, Reference } from '../types/openapi';
import { OpenAPIParser as CoreOpenAPIParser } from '../../../../core/dist/openapi-parser.js';

/** OpenAPI parsing and local reference resolution helpers used by the React renderer. */
export class OpenAPIParser {
  /**
   * Parse and minimally validate an OpenAPI JSON/YAML string or object.
   * @param input OpenAPI source text or already-parsed object.
   * @returns Parsed OpenAPI document.
   */
  static async parseSpec(input: string | object): Promise<OpenAPISpec> {
    return CoreOpenAPIParser.parseSpec(input) as Promise<OpenAPISpec>;
  }

  /**
   * Return HTTP methods present on one path item.
   * @param pathItem OpenAPI path item to inspect.
   * @returns Lowercase HTTP methods in FlexDoc's canonical display order.
   */
  static getHttpMethods(pathItem: PathItem): string[] {
    return CoreOpenAPIParser.getHttpMethods(pathItem);
  }

  /**
   * Return renderer utility classes for an HTTP method badge.
   * @param method HTTP method, case-insensitive.
   * @param theme Light or dark renderer theme.
   * @returns Tailwind utility-class string used by method badges.
   */
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

  /**
   * Decode one RFC 6901 JSON Pointer path token.
   * @param token Encoded pointer token.
   * @returns Decoded object-key token.
   */
  static decodePointerToken(token: string): string { return CoreOpenAPIParser.decodePointerToken(token); }

  /**
   * Encode one object key for use as an RFC 6901 JSON Pointer token.
   * @param token Raw object-key token.
   * @returns Escaped pointer token.
   */
  static encodePointerToken(token: string): string { return CoreOpenAPIParser.encodePointerToken(token); }

  /**
   * Resolve a synchronous local OpenAPI reference.
   * @param spec Root document containing the referenced value.
   * @param ref Local `#/...` JSON Pointer reference.
   * @returns Referenced value cast to the requested generic type.
   */
  static resolveReference<T = unknown>(spec: OpenAPISpec | Record<string, unknown>, ref: string): T {
    return CoreOpenAPIParser.resolveReference(spec, ref) as T;
  }

  /**
   * Test whether a value is an OpenAPI Reference Object.
   * @param obj Value to inspect.
   * @returns `true` when the value contains a string `$ref` field.
   */
  static isReference(obj: unknown): obj is Reference { return CoreOpenAPIParser.isReference(obj); }
}
