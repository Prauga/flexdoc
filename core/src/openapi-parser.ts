import * as yaml from 'js-yaml';
import type { OpenAPISpec, Reference } from './types/openapi.js';

export class OpenAPIParser {
  static async parseSpec(input: string | object): Promise<OpenAPISpec> {
    let spec: any;
    if (typeof input === 'string') {
      const trimmedInput = input.trim();
      try { spec = JSON.parse(trimmedInput); }
      catch {
        try { spec = yaml.load(trimmedInput); }
        catch { throw new Error('Invalid OpenAPI specification format'); }
      }
    } else spec = input;

    if (!spec.openapi || !spec.info || !spec.paths) throw new Error('Invalid OpenAPI specification: missing required fields');
    return spec as OpenAPISpec;
  }

  static getHttpMethods(pathItem: any): string[] {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
    return methods.filter((method) => pathItem[method]);
  }

  static decodePointerToken(token: string): string {
    return decodeURIComponent(token).replace(/~1/g, '/').replace(/~0/g, '~');
  }

  static encodePointerToken(token: string): string {
    return token.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  static resolveReference(spec: OpenAPISpec | Record<string, unknown>, ref: string): any {
    if (!ref.startsWith('#/')) throw new Error(`Only local references are supported synchronously; bundle external references first: ${ref}`);
    const path = ref.substring(2).split('/').map(OpenAPIParser.decodePointerToken);
    let current: any = spec;
    for (const segment of path) {
      if (current === null || typeof current !== 'object' || !(segment in current)) throw new Error(`Reference not found: ${ref}`);
      current = current[segment];
    }
    return current;
  }

  static isReference(obj: unknown): obj is Reference {
    return !!obj && typeof obj === 'object' && '$ref' in obj && typeof (obj as Reference).$ref === 'string';
  }
}
