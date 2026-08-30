import { openapi30Spec, openapi31Spec, externalRootSpec, externalDocuments } from '../fixtures/openapi/compatibility';
import { OpenAPIParser } from './openapi-parser';
import { bundleExternalReferences, EXTERNAL_DOCUMENTS_KEY } from './openapi-resolver';
import { normalizeOperation, resolveServerVariables } from './openapi-normalizer';
import { buildRequest, initialRequestValues } from './request-builder';

function responseSchema(spec: any, path: string, method: string, status: string) {
  return normalizeOperation(spec, path, method).responses[status].content?.['application/json']?.schema;
}

describe('OpenAPI compatibility corpus', () => {
  it('parses OpenAPI 3.0 JSON and 3.1 YAML while rejecting malformed documents', async () => {
    await expect(OpenAPIParser.parseSpec(JSON.stringify(openapi30Spec))).resolves.toMatchObject({ openapi: '3.0.3' });
    await expect(OpenAPIParser.parseSpec(`openapi: 3.1.0\ninfo:\n  title: YAML API\n  version: '1'\npaths: {}`)).resolves.toMatchObject({ openapi: '3.1.0' });
    await expect(OpenAPIParser.parseSpec('{ not-json')).rejects.toThrow('Invalid OpenAPI specification');
    await expect(OpenAPIParser.parseSpec({ openapi: '3.1.0', info: { title: 'x', version: '1' } })).rejects.toThrow('missing required fields');
  });

  it('merges path and operation parameters with operation-level precedence and resolves referenced responses/bodies', () => {
    const normalized = normalizeOperation(openapi30Spec, '/pets/{id}', 'GET');
    expect(normalized.parameters.find((parameter) => parameter.name === 'locale')?.schema).toMatchObject({ default: 'fr' });
    expect(normalized.responses['200'].description).toBe('pet response');
    expect(normalized.security).toEqual([{ bearer: [] }]);

    const payload = normalizeOperation(openapi30Spec, '/payload', 'post');
    expect(Object.keys(payload.requestBody?.content || {})).toEqual([
      'application/json', 'application/x-www-form-urlencoded', 'multipart/form-data',
    ]);
  });

  it('uses examples/defaults to initialize Try It values and validates server variables', () => {
    const values = initialRequestValues(openapi30Spec, '/pets/{id}', 'get');
    expect(values.parameters).toMatchObject({ locale: 'fr', tags: [], filter: {} });
    expect(resolveServerVariables(openapi30Spec.servers![0], { region: 'eu' })).toBe('https://eu.example.test');
    expect(() => resolveServerVariables(openapi30Spec.servers![0], { region: 'moon' })).toThrow('Invalid value for server variable region');
  });

  it('serializes OpenAPI query/path/header/cookie styles according to the declared style/explode settings', () => {
    const request = buildRequest(openapi31Spec, '/events/{coords}/{labels}/{matrix}', 'get', {
      serverUrl: 'https://api.example.test',
      parameters: {
        coords: ['3', '4'],
        labels: { role: 'admin', first: 'Alex' },
        matrix: { role: 'admin', first: 'Alex' },
        space: ['blue', 'black'],
        pipe: ['blue', 'black'],
        object: { role: 'admin', first: 'Alex' },
      },
    });
    expect(request.url).toBe(
      'https://api.example.test/events/.3.4/.role=admin.first=Alex/;role=admin;first=Alex' +
      '?space=blue%20black&pipe=blue%7Cblack&object=role%2Cadmin%2Cfirst%2CAlex',
    );
  });

  it('applies bearer, Basic and apiKey credentials in header/query/cookie locations and respects security alternatives', () => {
    const bearer = buildRequest(openapi30Spec, '/pets/{id}', 'get', {
      serverUrl: 'https://api.example.test', parameters: { id: '42' }, auth: { bearer: 'token' },
    });
    expect(bearer.headers.Authorization).toBe('Bearer token');

    const apiKeys = buildRequest(openapi30Spec, '/payload', 'post', {
      serverUrl: 'https://api.example.test',
      auth: { apiKeyHeader: 'header-secret', apiKeyQuery: 'query-secret', apiKeyCookie: 'cookie-secret' },
      body: '{}', contentType: 'application/json',
    });
    expect(apiKeys.headers['X-API-Key']).toBe('header-secret');
    expect(apiKeys.headers.Cookie).toBe('api_session=cookie-secret');
    expect(apiKeys.url).toContain('api_key=query-secret');

    const basicSpec = structuredClone(openapi30Spec);
    basicSpec.paths['/pets/{id}'].get!.security = [{ basic: [] }];
    const basic = buildRequest(basicSpec, '/pets/{id}', 'get', {
      serverUrl: 'https://api.example.test', parameters: { id: '42' }, auth: { basic: 'user:pa:ss' },
    });
    expect(basic.headers.Authorization).toMatch(/^Basic /);
  });

  it('builds JSON, urlencoded and multipart bodies without forcing a multipart content-type boundary', () => {
    const json = buildRequest(openapi30Spec, '/payload', 'post', { body: '{"name":"Ada"}', contentType: 'application/json' });
    expect(json.bodyKind).toBe('json');
    expect(json.headers['Content-Type']).toBe('application/json');

    const form = buildRequest(openapi30Spec, '/payload', 'post', {
      body: JSON.stringify({ name: 'Ada Lovelace', roles: ['admin', 'author'] }), contentType: 'application/x-www-form-urlencoded',
    });
    expect(form.body).toBe('name=Ada%20Lovelace&roles=admin&roles=author');

    const multipart = buildRequest(openapi30Spec, '/payload', 'post', {
      body: JSON.stringify({ name: 'Ada', tags: ['one', 'two'] }), contentType: 'multipart/form-data',
    });
    expect(multipart.bodyKind).toBe('multipart');
    expect(multipart.headers['Content-Type']).toBeUndefined();
    expect(multipart.init.body).toBeInstanceOf(FormData);
  });

  it('retains OpenAPI 3.1 JSON Schema composition, nullable type arrays, discriminators and recursive refs', () => {
    const schemas = openapi31Spec.components!.schemas!;
    expect(schemas.Event).toMatchObject({ discriminator: { propertyName: 'kind' } });
    expect(schemas.BaseEvent).toMatchObject({ properties: { metadata: { type: ['object', 'null'], additionalProperties: true } } });
    expect(schemas.StrictMap).toMatchObject({ additionalProperties: false });
    expect((schemas.CreatedEvent as any).allOf[1].properties.child.$ref).toBe('#/components/schemas/CreatedEvent');
  });

  it('bundles nested/circular external refs and rewrites an external ref back to the root document correctly', async () => {
    const bundled = await bundleExternalReferences(externalRootSpec, {
      baseUri: 'https://example.test/openapi.yaml',
      load: async (uri) => {
        if (!(uri in externalDocuments)) throw new Error(`Unexpected fixture URI: ${uri}`);
        return externalDocuments[uri];
      },
    }) as any;

    const schema = responseSchema(bundled, '/things', 'get', '200') as any;
    const thing = OpenAPIParser.resolveReference(bundled, schema.$ref);
    expect(thing.properties.rootMeta.$ref).toBe('#/components/schemas/RootMeta');
    expect(OpenAPIParser.resolveReference(bundled, thing.properties.rootMeta.$ref)).toMatchObject({ type: 'object' });

    const meta = OpenAPIParser.resolveReference(bundled, thing.properties.meta.$ref);
    expect(meta.properties.next.$ref).toContain(EXTERNAL_DOCUMENTS_KEY);
    expect(OpenAPIParser.resolveReference(bundled, meta.properties.next.$ref)).toMatchObject({ type: 'object' });
  });

  it('fails synchronously and clearly for unbundled external refs or missing local pointers', () => {
    expect(() => OpenAPIParser.resolveReference(openapi30Spec, './models.yaml#/Pet')).toThrow('bundle external references first');
    expect(() => OpenAPIParser.resolveReference(openapi30Spec, '#/components/schemas/DoesNotExist')).toThrow('Reference not found');
  });
});
