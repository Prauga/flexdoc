import * as yaml from 'js-yaml';
import type { OpenAPISpec, Reference } from './types/openapi.js';

/** Parse JSON or YAML OpenAPI documents and resolve local JSON Pointer references. */
export class OpenAPIParser {
  /**
   * Parse and minimally validate an OpenAPI document supplied as JSON/YAML text or an object.
   * @param input OpenAPI source text or an already-parsed document object.
   * @returns Parsed OpenAPI document.
   * @throws When the source cannot be parsed or required OpenAPI fields are missing.
   */
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

  /**
   * Return HTTP methods present on an OpenAPI path item.
   * @param pathItem Path-item object to inspect.
   * @returns Lowercase HTTP method names in FlexDoc's canonical order.
   */
  static getHttpMethods(pathItem: any): string[] {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
    return methods.filter((method) => pathItem[method]);
  }

  /**
   * Decode one JSON Pointer path token, including URI and RFC 6901 escaping.
   * @param token Encoded pointer token.
   * @returns Decoded object-key token.
   */
  static decodePointerToken(token: string): string {
    return decodeURIComponent(token).replace(/~1/g, '/').replace(/~0/g, '~');
  }

  /**
   * Encode one object key for use as a JSON Pointer token.
   * @param token Raw object-key token.
   * @returns RFC 6901 escaped token.
   */
  static encodePointerToken(token: string): string {
    return token.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  /**
   * Resolve a synchronous local `#/...` reference against an OpenAPI document.
   * @param spec Root document containing the referenced value.
   * @param ref Local JSON Pointer reference.
   * @returns Referenced value.
   * @throws When the reference is external or the pointer cannot be resolved.
   */
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

  /**
   * Test whether a value is an OpenAPI Reference Object.
   * @param obj Value to inspect.
   * @returns `true` when the value is an object with a string `$ref` field.
   */
  static isReference(obj: unknown): obj is Reference {
    return !!obj && typeof obj === 'object' && '$ref' in obj && typeof (obj as Reference).$ref === 'string';
  }
}
