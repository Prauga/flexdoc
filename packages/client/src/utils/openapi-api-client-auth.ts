import type { HttpAuth, HttpRequestDraft } from './http-client';
import { requestDraftFromBuiltRequest } from './http-client';
import type { BuiltRequest, RequestValues } from './request-builder';
import type { OpenAPISpec, Operation, Reference, SecurityScheme } from '../types/openapi';

function operationFor(spec: OpenAPISpec, path: string, method: string): Operation | undefined {
  const pathItem = spec.paths[path];
  return pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
}

function resolveSecurityScheme(spec: OpenAPISpec, schemeName: string): SecurityScheme | undefined {
  const value = spec.components?.securitySchemes?.[schemeName];
  if (!value) return undefined;
  if (!('$ref' in value)) return value as SecurityScheme;
  const ref = (value as Reference).$ref;
  const prefix = '#/components/securitySchemes/';
  if (!ref.startsWith(prefix)) return undefined;
  const target = spec.components?.securitySchemes?.[decodeURIComponent(ref.slice(prefix.length))];
  return target && !('$ref' in target) ? target as SecurityScheme : undefined;
}

function selectedRequirement(spec: OpenAPISpec, path: string, method: string, auth: Record<string, string>): Record<string, string[]> | undefined {
  const operation = operationFor(spec, path, method);
  const requirements = operation?.security ?? spec.security ?? [];
  if (!requirements.length) return undefined;

  const filledSingleScheme = requirements.find((requirement) => {
    const names = Object.keys(requirement);
    return names.length === 1 && !!auth[names[0]];
  });
  if (filledSingleScheme) return filledSingleScheme;

  const filledRequirement = requirements.find((requirement) => {
    const names = Object.keys(requirement);
    return names.length > 0 && names.every((name) => !!auth[name]);
  });
  if (filledRequirement) return filledRequirement;

  return requirements.find((requirement) => Object.keys(requirement).length === 0) ?? requirements[0];
}

function translateScheme(scheme: SecurityScheme, value: string): HttpAuth | undefined {
  if (!value) return undefined;
  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') return { type: 'bearer', token: value };
  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
    const separator = value.indexOf(':');
    return separator >= 0
      ? { type: 'basic', username: value.slice(0, separator), password: value.slice(separator + 1) }
      : { type: 'basic', username: value, password: '' };
  }
  if (scheme.type === 'apiKey' && (scheme.in === 'header' || scheme.in === 'query') && scheme.name) {
    return { type: 'apiKey', key: scheme.name, value, in: scheme.in };
  }
  if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') return { type: 'bearer', token: value };
  return undefined;
}

function withoutHeader(draft: HttpRequestDraft, name: string): HttpRequestDraft {
  return { ...draft, headers: draft.headers?.filter((entry) => entry.key.toLowerCase() !== name.toLowerCase()) };
}

function withoutQuery(draft: HttpRequestDraft, name: string): HttpRequestDraft {
  return { ...draft, query: draft.query?.filter((entry) => entry.key !== name) };
}

export function requestDraftFromOpenApiRequest(
  spec: OpenAPISpec,
  path: string,
  method: string,
  values: RequestValues,
  request: BuiltRequest,
): HttpRequestDraft {
  let draft = requestDraftFromBuiltRequest(request);
  const requirement = selectedRequirement(spec, path, method, values.auth || {});
  if (!requirement || Object.keys(requirement).length !== 1) return draft;

  const schemeName = Object.keys(requirement)[0];
  const scheme = resolveSecurityScheme(spec, schemeName);
  const credential = values.auth?.[schemeName] || '';
  if (!scheme || !credential) return draft;

  const auth = translateScheme(scheme, credential);
  if (!auth) return draft;

  if (auth.type === 'bearer' || auth.type === 'basic') draft = withoutHeader(draft, 'Authorization');
  else if (auth.type === 'apiKey' && auth.in === 'header') draft = withoutHeader(draft, auth.key);
  else if (auth.type === 'apiKey' && auth.in === 'query') draft = withoutQuery(draft, auth.key);

  return { ...draft, auth };
}
