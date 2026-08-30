export interface OpenAPISpec {
  openapi: string;
  jsonSchemaDialect?: string;
  info: Info;
  servers?: Server[];
  paths: Paths;
  webhooks?: Paths;
  components?: Components;
  security?: SecurityRequirement[];
  tags?: Tag[];
  externalDocs?: ExternalDocumentation;
  [extension: `x-${string}`]: unknown;
}

export interface Info {
  title: string;
  summary?: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  version: string;
}
export interface Contact { name?: string; url?: string; email?: string; }
export interface License { name: string; identifier?: string; url?: string; }
export interface Server { url: string; description?: string; variables?: Record<string, ServerVariable>; }
export interface ServerVariable { enum?: string[]; default: string; description?: string; }
export interface Paths { [path: string]: PathItem; }
export interface PathItem {
  $ref?: string; summary?: string; description?: string;
  get?: Operation; put?: Operation; post?: Operation; delete?: Operation; options?: Operation; head?: Operation; patch?: Operation; trace?: Operation;
  servers?: Server[]; parameters?: (Parameter | Reference)[];
}
export interface Operation {
  tags?: string[]; summary?: string; description?: string; externalDocs?: ExternalDocumentation; operationId?: string;
  parameters?: (Parameter | Reference)[]; requestBody?: RequestBody | Reference; responses: Responses;
  callbacks?: Record<string, Callback | Reference>; deprecated?: boolean; security?: SecurityRequirement[]; servers?: Server[];
}
export interface Parameter {
  name: string; in: 'query' | 'header' | 'path' | 'cookie'; description?: string; required?: boolean; deprecated?: boolean;
  allowEmptyValue?: boolean; style?: string; explode?: boolean; allowReserved?: boolean; schema?: Schema | Reference; example?: any;
  examples?: Record<string, Example | Reference>; content?: Record<string, MediaType>;
}
export interface RequestBody { description?: string; content: Record<string, MediaType>; required?: boolean; }
export interface MediaType { schema?: Schema | Reference; example?: any; examples?: Record<string, Example | Reference>; encoding?: Record<string, Encoding>; }
export interface Encoding { contentType?: string; headers?: Record<string, Header | Reference>; style?: string; explode?: boolean; allowReserved?: boolean; }
export interface Responses { [statusCode: string]: Response | Reference; }
export interface Response { description: string; headers?: Record<string, Header | Reference>; content?: Record<string, MediaType>; links?: Record<string, Link | Reference>; }
export interface Header { description?: string; required?: boolean; deprecated?: boolean; allowEmptyValue?: boolean; style?: string; explode?: boolean; allowReserved?: boolean; schema?: Schema | Reference; example?: any; examples?: Record<string, Example | Reference>; }

export interface Schema {
  $id?: string; $schema?: string; title?: string; description?: string;
  type?: string | string[]; format?: string; const?: any; enum?: any[]; default?: any; examples?: any[]; example?: any;
  multipleOf?: number; maximum?: number; exclusiveMaximum?: boolean | number; minimum?: number; exclusiveMinimum?: boolean | number;
  maxLength?: number; minLength?: number; pattern?: string; maxItems?: number; minItems?: number; uniqueItems?: boolean;
  maxProperties?: number; minProperties?: number; required?: string[];
  allOf?: (Schema | Reference)[]; oneOf?: (Schema | Reference)[]; anyOf?: (Schema | Reference)[]; not?: Schema | Reference;
  if?: Schema | Reference; then?: Schema | Reference; else?: Schema | Reference;
  items?: Schema | Reference; prefixItems?: (Schema | Reference)[]; contains?: Schema | Reference;
  properties?: Record<string, Schema | Reference>; patternProperties?: Record<string, Schema | Reference>;
  additionalProperties?: boolean | Schema | Reference; unevaluatedProperties?: boolean | Schema | Reference;
  dependentSchemas?: Record<string, Schema | Reference>; propertyNames?: Schema | Reference;
  nullable?: boolean; discriminator?: Discriminator; readOnly?: boolean; writeOnly?: boolean; xml?: XML;
  externalDocs?: ExternalDocumentation; deprecated?: boolean;
}
export interface Discriminator { propertyName: string; mapping?: Record<string, string>; }
export interface XML { name?: string; namespace?: string; prefix?: string; attribute?: boolean; wrapped?: boolean; }
export interface Reference { $ref: string; summary?: string; description?: string; }
export interface Example { summary?: string; description?: string; value?: any; externalValue?: string; }
export interface Link { operationRef?: string; operationId?: string; parameters?: Record<string, any>; requestBody?: any; description?: string; server?: Server; }
export interface Callback { [expression: string]: PathItem; }
export interface Components {
  schemas?: Record<string, Schema | Reference>; responses?: Record<string, Response | Reference>; parameters?: Record<string, Parameter | Reference>;
  examples?: Record<string, Example | Reference>; requestBodies?: Record<string, RequestBody | Reference>; headers?: Record<string, Header | Reference>;
  securitySchemes?: Record<string, SecurityScheme | Reference>; links?: Record<string, Link | Reference>; callbacks?: Record<string, Callback | Reference>;
  pathItems?: Record<string, PathItem | Reference>;
}
export interface SecurityScheme {
  type: string; description?: string; name?: string; in?: string; scheme?: string; bearerFormat?: string; flows?: OAuthFlows; openIdConnectUrl?: string;
}
export interface OAuthFlows { implicit?: OAuthFlow; password?: OAuthFlow; clientCredentials?: OAuthFlow; authorizationCode?: OAuthFlow; }
export interface OAuthFlow { authorizationUrl?: string; tokenUrl?: string; refreshUrl?: string; scopes: Record<string, string>; }
export interface SecurityRequirement { [name: string]: string[]; }
export interface Tag { name: string; description?: string; externalDocs?: ExternalDocumentation; }
export interface ExternalDocumentation { description?: string; url: string; }
