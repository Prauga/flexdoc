/** OpenAPI 3.x document shape used by the FlexDoc core engine. */
export interface OpenAPISpec {
  /** OpenAPI specification version, for example `3.0.3` or `3.1.1`. */
  openapi: string;
  /** Default JSON Schema dialect URI used by schemas in an OpenAPI 3.1 document. */
  jsonSchemaDialect?: string;
  /** API metadata displayed by documentation renderers and tooling. */
  info: Info;
  /** Server definitions available as defaults for operations in the document. */
  servers?: Server[];
  /** Path-template map containing HTTP operations exposed by the API. */
  paths: Paths;
  /** OpenAPI 3.1 webhook path items keyed by webhook name or expression. */
  webhooks?: Paths;
  /** Reusable schemas, responses, parameters, security schemes, and related components. */
  components?: Components;
  /** Security requirements applied by default to operations that do not override them. */
  security?: SecurityRequirement[];
  /** Tags used to group and describe operations. */
  tags?: Tag[];
  /** External documentation associated with the API as a whole. */
  externalDocs?: ExternalDocumentation;
  /** Vendor extension value keyed by an `x-` prefixed name. */
  [extension: `x-${string}`]: unknown;
}

/** Descriptive metadata for an OpenAPI document. */
export interface Info {
  /** Human-readable API title. */
  title: string;
  /** Short summary of the API. */
  summary?: string;
  /** Longer Markdown-capable API description. */
  description?: string;
  /** URL for the API terms of service. */
  termsOfService?: string;
  /** Contact information for the API owner or support team. */
  contact?: Contact;
  /** License information for the described API. */
  license?: License;
  /** API document version supplied by the author. */
  version: string;
}

/** Contact information attached to OpenAPI metadata. */
export interface Contact {
  /** Contact person, team, or organization name. */
  name?: string;
  /** Contact or support URL. */
  url?: string;
  /** Contact email address. */
  email?: string;
}

/** License metadata attached to the API description. */
export interface License {
  /** Human-readable license name. */
  name: string;
  /** SPDX license identifier used by OpenAPI 3.1 documents. */
  identifier?: string;
  /** URL containing the license text or additional information. */
  url?: string;
}

/** Server base URL and optional template variables. */
export interface Server {
  /** Server URL, optionally containing `{variable}` placeholders. */
  url: string;
  /** Human-readable description of the server. */
  description?: string;
  /** Definitions for variables referenced by the server URL template. */
  variables?: Record<string, ServerVariable>;
}

/** One variable used by a templated server URL. */
export interface ServerVariable {
  /** Allowed values for the variable. */
  enum?: string[];
  /** Default value substituted when no explicit value is provided. */
  default: string;
  /** Human-readable explanation of the variable. */
  description?: string;
}

/** Map of OpenAPI path templates to path items. */
export interface Paths {
  /** Path item registered for a concrete OpenAPI path-template key. */
  [path: string]: PathItem;
}

/** Operations and shared metadata defined for one OpenAPI path. */
export interface PathItem {
  /** Reference to another path-item definition. */
  $ref?: string;
  /** Short summary shared by operations on this path. */
  summary?: string;
  /** Longer description shared by operations on this path. */
  description?: string;
  /** GET operation for this path. */
  get?: Operation;
  /** PUT operation for this path. */
  put?: Operation;
  /** POST operation for this path. */
  post?: Operation;
  /** DELETE operation for this path. */
  delete?: Operation;
  /** OPTIONS operation for this path. */
  options?: Operation;
  /** HEAD operation for this path. */
  head?: Operation;
  /** PATCH operation for this path. */
  patch?: Operation;
  /** TRACE operation for this path. */
  trace?: Operation;
  /** Servers that override document-level servers for this path. */
  servers?: Server[];
  /** Parameters shared by every operation on this path. */
  parameters?: (Parameter | Reference)[];
}

/** One HTTP operation described by OpenAPI. */
export interface Operation {
  /** Tags used to group the operation. */
  tags?: string[];
  /** Short operation summary. */
  summary?: string;
  /** Longer Markdown-capable operation description. */
  description?: string;
  /** External documentation associated with the operation. */
  externalDocs?: ExternalDocumentation;
  /** Stable author-provided operation identifier. */
  operationId?: string;
  /** Path- or operation-level parameters after OpenAPI reference resolution. */
  parameters?: (Parameter | Reference)[];
  /** Request-body definition accepted by the operation. */
  requestBody?: RequestBody | Reference;
  /** Response definitions keyed by status code or `default`. */
  responses: Responses;
  /** Callback definitions initiated by the operation. */
  callbacks?: Record<string, Callback | Reference>;
  /** Whether the operation is deprecated. */
  deprecated?: boolean;
  /** Security requirements overriding document-level security. */
  security?: SecurityRequirement[];
  /** Servers overriding path- and document-level servers for this operation. */
  servers?: Server[];
}

/** Parameter supplied through the query string, headers, path, or cookies. */
export interface Parameter {
  /** Parameter name as it appears in its transport location. */
  name: string;
  /** Transport location for the parameter. */
  in: 'query' | 'header' | 'path' | 'cookie';
  /** Human-readable parameter description. */
  description?: string;
  /** Whether the parameter must be supplied. Path parameters are required by OpenAPI. */
  required?: boolean;
  /** Whether use of the parameter is deprecated. */
  deprecated?: boolean;
  /** Whether an empty value is allowed for query parameters. */
  allowEmptyValue?: boolean;
  /** OpenAPI serialization style used for the parameter. */
  style?: string;
  /** Whether arrays/objects are exploded during serialization. */
  explode?: boolean;
  /** Whether reserved URI characters may remain unescaped. */
  allowReserved?: boolean;
  /** Schema describing the parameter value. */
  schema?: Schema | Reference;
  /** Inline example value. */
  example?: any;
  /** Named example definitions. */
  examples?: Record<string, Example | Reference>;
  /** Media-type keyed content definition used instead of `schema`. */
  content?: Record<string, MediaType>;
}

/** Request body accepted by an operation. */
export interface RequestBody {
  /** Human-readable request-body description. */
  description?: string;
  /** Supported request media types and their schemas/examples. */
  content: Record<string, MediaType>;
  /** Whether a request body is required. */
  required?: boolean;
}

/** Schema, examples, and encoding metadata for one media type. */
export interface MediaType {
  /** Schema describing the media-type payload. */
  schema?: Schema | Reference;
  /** Inline example payload. */
  example?: any;
  /** Named example payloads. */
  examples?: Record<string, Example | Reference>;
  /** Per-property encoding rules, primarily for multipart/form payloads. */
  encoding?: Record<string, Encoding>;
}

/** Encoding overrides for one request-body property. */
export interface Encoding {
  /** Content type used for the encoded property. */
  contentType?: string;
  /** Headers emitted for the encoded property. */
  headers?: Record<string, Header | Reference>;
  /** Serialization style used for the property. */
  style?: string;
  /** Whether arrays/objects are exploded during serialization. */
  explode?: boolean;
  /** Whether reserved URI characters may remain unescaped. */
  allowReserved?: boolean;
}

/** Response map keyed by HTTP status code, range, or `default`. */
export interface Responses {
  /** Response definition for one OpenAPI response key. */
  [statusCode: string]: Response | Reference;
}

/** One HTTP response definition. */
export interface Response {
  /** Required human-readable description of the response. */
  description: string;
  /** Response headers keyed by header name. */
  headers?: Record<string, Header | Reference>;
  /** Response bodies keyed by media type. */
  content?: Record<string, MediaType>;
  /** Link definitions exposed by the response. */
  links?: Record<string, Link | Reference>;
}

/** Reusable or response-specific HTTP header definition. */
export interface Header {
  /** Human-readable header description. */
  description?: string;
  /** Whether the header is required. */
  required?: boolean;
  /** Whether the header is deprecated. */
  deprecated?: boolean;
  /** Whether an empty value is permitted. */
  allowEmptyValue?: boolean;
  /** Serialization style used for the header value. */
  style?: string;
  /** Whether arrays/objects are exploded during serialization. */
  explode?: boolean;
  /** Whether reserved characters may remain unescaped. */
  allowReserved?: boolean;
  /** Schema describing the header value. */
  schema?: Schema | Reference;
  /** Inline example header value. */
  example?: any;
  /** Named example header values. */
  examples?: Record<string, Example | Reference>;
}

/** JSON Schema vocabulary supported by FlexDoc for OpenAPI 3.0/3.1 documents. */
export interface Schema {
  /** JSON Schema identifier URI. */
  $id?: string;
  /** JSON Schema dialect URI. */
  $schema?: string;
  /** Human-readable schema title. */
  title?: string;
  /** Human-readable schema description. */
  description?: string;
  /** Allowed JSON type or types. */
  type?: string | string[];
  /** Semantic format hint such as `date-time`, `uuid`, or `email`. */
  format?: string;
  /** Exact constant value required by JSON Schema. */
  const?: any;
  /** Enumerated set of allowed values. */
  enum?: any[];
  /** Default value advertised by the schema. */
  default?: any;
  /** Example values used by JSON Schema/OpenAPI 3.1. */
  examples?: any[];
  /** Legacy singular OpenAPI example value. */
  example?: any;
  /** Numeric value must be a multiple of this number. */
  multipleOf?: number;
  /** Inclusive upper numeric bound unless paired with legacy boolean exclusivity. */
  maximum?: number;
  /** Exclusive upper bound, represented as a boolean in OAS 3.0 or number in JSON Schema/OAS 3.1. */
  exclusiveMaximum?: boolean | number;
  /** Inclusive lower numeric bound unless paired with legacy boolean exclusivity. */
  minimum?: number;
  /** Exclusive lower bound, represented as a boolean in OAS 3.0 or number in JSON Schema/OAS 3.1. */
  exclusiveMinimum?: boolean | number;
  /** Maximum string length. */
  maxLength?: number;
  /** Minimum string length. */
  minLength?: number;
  /** Regular-expression constraint for string values. */
  pattern?: string;
  /** Maximum number of array items. */
  maxItems?: number;
  /** Minimum number of array items. */
  minItems?: number;
  /** Whether every array item must be unique. */
  uniqueItems?: boolean;
  /** Maximum number of object properties. */
  maxProperties?: number;
  /** Minimum number of object properties. */
  minProperties?: number;
  /** Object property names that must be present. */
  required?: string[];
  /** Schema must satisfy every listed subschema. */
  allOf?: (Schema | Reference)[];
  /** Schema must satisfy exactly one listed subschema. */
  oneOf?: (Schema | Reference)[];
  /** Schema must satisfy at least one listed subschema. */
  anyOf?: (Schema | Reference)[];
  /** Schema must not satisfy this subschema. */
  not?: Schema | Reference;
  /** Conditional schema predicate. */
  if?: Schema | Reference;
  /** Schema applied when `if` succeeds. */
  then?: Schema | Reference;
  /** Schema applied when `if` fails. */
  else?: Schema | Reference;
  /** Schema applied to array items. */
  items?: Schema | Reference;
  /** Positional schemas for tuple-like arrays. */
  prefixItems?: (Schema | Reference)[];
  /** Schema that at least one array item must satisfy. */
  contains?: Schema | Reference;
  /** Named object properties and their schemas. */
  properties?: Record<string, Schema | Reference>;
  /** Regex-keyed schemas applied to matching object properties. */
  patternProperties?: Record<string, Schema | Reference>;
  /** Whether or how undeclared object properties are validated. */
  additionalProperties?: boolean | Schema | Reference;
  /** JSON Schema rule for properties not evaluated by another keyword. */
  unevaluatedProperties?: boolean | Schema | Reference;
  /** Schemas activated by the presence of named object properties. */
  dependentSchemas?: Record<string, Schema | Reference>;
  /** Schema applied to object property names. */
  propertyNames?: Schema | Reference;
  /** OpenAPI 3.0 nullable extension for allowing `null`. */
  nullable?: boolean;
  /** Polymorphism discriminator metadata. */
  discriminator?: Discriminator;
  /** Whether the value is intended only for responses. */
  readOnly?: boolean;
  /** Whether the value is intended only for requests. */
  writeOnly?: boolean;
  /** XML serialization metadata. */
  xml?: XML;
  /** External documentation associated with the schema. */
  externalDocs?: ExternalDocumentation;
  /** Whether the schema/value is deprecated. */
  deprecated?: boolean;
}

/** Polymorphism discriminator configuration. */
export interface Discriminator {
  /** Property whose value selects the concrete schema. */
  propertyName: string;
  /** Optional discriminator-value to schema-reference mapping. */
  mapping?: Record<string, string>;
}

/** XML serialization hints for a schema. */
export interface XML {
  /** XML element or attribute name. */
  name?: string;
  /** XML namespace URI. */
  namespace?: string;
  /** Namespace prefix. */
  prefix?: string;
  /** Whether the value is serialized as an XML attribute. */
  attribute?: boolean;
  /** Whether array items are wrapped in a containing element. */
  wrapped?: boolean;
}

/** OpenAPI reference object. */
export interface Reference {
  /** Reference URI or JSON Pointer. */
  $ref: string;
  /** OpenAPI 3.1 reference summary override. */
  summary?: string;
  /** OpenAPI 3.1 reference description override. */
  description?: string;
}

/** Named or inline OpenAPI example. */
export interface Example {
  /** Short example summary. */
  summary?: string;
  /** Longer example description. */
  description?: string;
  /** Inline example value. */
  value?: any;
  /** URL containing the example value when it is stored externally. */
  externalValue?: string;
}

/** Link from a response to another operation. */
export interface Link {
  /** Reference to the target operation. */
  operationRef?: string;
  /** `operationId` of the target operation. */
  operationId?: string;
  /** Parameter expressions passed to the target operation. */
  parameters?: Record<string, any>;
  /** Request-body expression passed to the target operation. */
  requestBody?: any;
  /** Human-readable link description. */
  description?: string;
  /** Server used by the target operation. */
  server?: Server;
}

/** Callback expression map containing path items invoked by the API. */
export interface Callback {
  /** Path item associated with one runtime callback expression. */
  [expression: string]: PathItem;
}

/** Reusable component registry for an OpenAPI document. */
export interface Components {
  /** Reusable schemas keyed by component name. */
  schemas?: Record<string, Schema | Reference>;
  /** Reusable responses keyed by component name. */
  responses?: Record<string, Response | Reference>;
  /** Reusable parameters keyed by component name. */
  parameters?: Record<string, Parameter | Reference>;
  /** Reusable examples keyed by component name. */
  examples?: Record<string, Example | Reference>;
  /** Reusable request bodies keyed by component name. */
  requestBodies?: Record<string, RequestBody | Reference>;
  /** Reusable headers keyed by component name. */
  headers?: Record<string, Header | Reference>;
  /** Reusable security schemes keyed by component name. */
  securitySchemes?: Record<string, SecurityScheme | Reference>;
  /** Reusable links keyed by component name. */
  links?: Record<string, Link | Reference>;
  /** Reusable callbacks keyed by component name. */
  callbacks?: Record<string, Callback | Reference>;
  /** Reusable path items keyed by component name. */
  pathItems?: Record<string, PathItem | Reference>;
}

/** Authentication or authorization scheme described by OpenAPI. */
export interface SecurityScheme {
  /** Security scheme type such as `apiKey`, `http`, `oauth2`, or `openIdConnect`. */
  type: string;
  /** Human-readable security scheme description. */
  description?: string;
  /** API-key parameter name when `type` is `apiKey`. */
  name?: string;
  /** API-key location when `type` is `apiKey`. */
  in?: string;
  /** HTTP authentication scheme such as `basic` or `bearer`. */
  scheme?: string;
  /** Optional bearer-token format hint. */
  bearerFormat?: string;
  /** OAuth 2.0 flow definitions. */
  flows?: OAuthFlows;
  /** OpenID Connect discovery URL. */
  openIdConnectUrl?: string;
}

/** OAuth 2.0 flow variants supported by an OpenAPI security scheme. */
export interface OAuthFlows {
  /** Implicit OAuth flow. */
  implicit?: OAuthFlow;
  /** Resource-owner password OAuth flow. */
  password?: OAuthFlow;
  /** Client-credentials OAuth flow. */
  clientCredentials?: OAuthFlow;
  /** Authorization-code OAuth flow. */
  authorizationCode?: OAuthFlow;
}

/** One OAuth 2.0 flow definition. */
export interface OAuthFlow {
  /** Authorization endpoint used by browser-based flows. */
  authorizationUrl?: string;
  /** Token endpoint used to obtain access tokens. */
  tokenUrl?: string;
  /** Optional endpoint used to refresh access tokens. */
  refreshUrl?: string;
  /** Available OAuth scopes keyed by scope name. */
  scopes: Record<string, string>;
}

/** Security requirement mapping scheme names to required scopes. */
export interface SecurityRequirement {
  /** OAuth/OpenID scope names required for one referenced security scheme. */
  [name: string]: string[];
}

/** Operation grouping metadata. */
export interface Tag {
  /** Tag name referenced by operations. */
  name: string;
  /** Human-readable tag description. */
  description?: string;
  /** External documentation associated with the tag. */
  externalDocs?: ExternalDocumentation;
}

/** Link to documentation hosted outside the OpenAPI document. */
export interface ExternalDocumentation {
  /** Human-readable description of the external documentation. */
  description?: string;
  /** URL of the external documentation. */
  url: string;
}
