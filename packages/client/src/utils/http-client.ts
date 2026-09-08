import {
  buildHttpRequest as coreBuildHttpRequest,
  httpHostExecutionRequirements as coreHttpHostExecutionRequirements,
  inferHttpBodyMode as coreInferHttpBodyMode,
  requestDraftFromBuiltRequest as coreRequestDraftFromBuiltRequest,
  resolveHttpRequestDraftVariables as coreResolveHttpRequestDraftVariables,
} from '../../../../core/dist/http-client.js';
import type { BuiltRequest } from './request-builder';

/** One editable key/value row used by query, header, and form editors. */
export interface HttpKeyValue {
  /** Parameter/header/form field name. */ key: string;
  /** Parameter/header/form field value. */ value: string;
  /** Whether the row participates in request construction. Defaults to enabled. */ enabled?: boolean;
}

/** Body editor/serialization mode used by API Client. */
export type HttpBodyMode = 'none' | 'raw' | 'json' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';

/** One multipart/form-data field. */
export interface HttpFormDataEntry extends HttpKeyValue {
  /** Whether this row carries plain text or a file. */ type?: 'text' | 'file';
  /** Browser `File` selected for a file row. */ file?: File;
  /** File name sent to the server; defaults to the selected file name. */ fileName?: string;
  /** Optional content type for the file part. */ contentType?: string;
}

/** GraphQL request body editor state. */
export interface HttpGraphqlBody {
  /** GraphQL operation/query text. */ query: string;
  /** JSON text containing GraphQL variables. */ variables: string;
}

/** Binary request body editor state. */
export interface HttpBinaryBody {
  /** Browser `File` selected as the raw request body. */ file?: File;
  /** File name retained for persistence/history when the `File` itself is unavailable. */ fileName?: string;
  /** Content type advertised for the binary body. */ contentType?: string;
}

/** Capability that requires execution inside the backend host rather than normal browser Fetch. */
export type HttpHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';

/** Per-request API-host execution selections. */
export interface HttpHostExecutionSelection {
  /** Id of a server-side client certificate configured by the documentation host. */ certificateId?: string;
  /** Use FlexDoc's server-side session cookie jar for the request. */ cookieJar?: 'session';
}

/** Explicitly disable authentication for one request. */
export interface HttpNoAuth {
  /** Authentication discriminator. */ type: 'none';
}

/** Inherit authentication from the containing collection/folder context. */
export interface HttpInheritedAuth {
  /** Authentication discriminator. */ type: 'inherit';
}

/** HTTP Bearer token authentication. */
export interface HttpBearerAuth {
  /** Authentication discriminator. */ type: 'bearer';
  /** Bearer token sent in the Authorization header. */ token: string;
}

/** HTTP Basic authentication credentials. */
export interface HttpBasicAuth {
  /** Authentication discriminator. */ type: 'basic';
  /** Basic-auth username. */ username: string;
  /** Basic-auth password. */ password: string;
}

/** API-key authentication configuration. */
export interface HttpApiKeyAuth {
  /** Authentication discriminator. */ type: 'apiKey';
  /** Header/query/cookie name used for the API key. */ key: string;
  /** API-key value. */ value: string;
  /** Request location where the API key is applied. */ in: 'header' | 'query' | 'cookie';
}

/** HTTP Digest authentication credentials. */
export interface HttpDigestAuth {
  /** Authentication discriminator. */ type: 'digest';
  /** Digest username. */ username: string;
  /** Digest password. */ password: string;
}

/** Hawk authentication credentials and signing options. */
export interface HttpHawkAuth {
  /** Authentication discriminator. */ type: 'hawk';
  /** Hawk credential id. */ id: string;
  /** Hawk shared signing key. */ key: string;
  /** Hawk MAC algorithm. */ algorithm?: 'sha1' | 'sha256';
  /** Optional Hawk `ext` application data. */ ext?: string;
}

/** NTLM/Negotiate authentication credentials. */
export interface HttpNtlmAuth {
  /** Authentication discriminator. */ type: 'ntlm';
  /** NTLM username. */ username: string;
  /** NTLM password. */ password: string;
  /** Optional Windows/NTLM domain. */ domain?: string;
  /** Optional workstation name. */ workstation?: string;
}

/** OAuth 1.0a signing configuration. */
export interface HttpOAuth1Auth {
  /** Authentication discriminator. */ type: 'oauth1';
  /** OAuth consumer key. */ consumerKey: string;
  /** OAuth consumer secret. */ consumerSecret: string;
  /** Optional resource-owner/access token. */ token?: string;
  /** Optional token secret. */ tokenSecret?: string;
  /** OAuth 1 signature method. */ signatureMethod?: 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT';
  /** Optional Authorization-header realm. */ realm?: string;
}

/** AWS Signature Version 4 credentials and signing scope. */
export interface HttpAwsV4Auth {
  /** Authentication discriminator. */ type: 'awsv4';
  /** AWS access key id. */ accessKey: string;
  /** AWS secret access key. */ secretKey: string;
  /** Optional temporary session token. */ sessionToken?: string;
  /** AWS signing region. */ region: string;
  /** AWS service name used in the credential scope. */ service: string;
}

/** OAuth 2 flow represented by API Client. */
export type HttpOAuth2GrantType = 'accessToken' | 'authorizationCode' | 'clientCredentials' | 'password' | 'implicit';

/** OAuth 2 authentication configuration and optional token-acquisition metadata. */
export interface HttpOAuth2Auth {
  /** Authentication discriminator. */ type: 'oauth2';
  /** Bearer access token currently used for request execution. */ accessToken: string;
  /** OAuth flow used to acquire or describe the token. */ grantType?: HttpOAuth2GrantType;
  /** Authorization endpoint for authorization-code/implicit flows. */ authorizationUrl?: string;
  /** Token endpoint for code, client-credentials, password, or refresh flows. */ tokenUrl?: string;
  /** OAuth client id. */ clientId?: string;
  /** OAuth client secret. */ clientSecret?: string;
  /** How client credentials are sent to the token endpoint. */ clientAuthentication?: 'body' | 'basic';
  /** Redirect URI used by browser authorization flows. */ redirectUri?: string;
  /** Requested OAuth scopes. */ scopes?: string[];
  /** Resource-owner username for the password grant. */ username?: string;
  /** Resource-owner password for the password grant. */ password?: string;
  /** Refresh token retained for token renewal. */ refreshToken?: string;
}

/** Authentication mode attached to an arbitrary API Client request. */
export type HttpAuth =
  | HttpNoAuth
  | HttpInheritedAuth
  | HttpBearerAuth
  | HttpOAuth2Auth
  | HttpBasicAuth
  | HttpApiKeyAuth
  | HttpDigestAuth
  | HttpHawkAuth
  | HttpNtlmAuth
  | HttpOAuth1Auth
  | HttpAwsV4Auth;

/** Editable HTTP request draft used by the API Client and host execution. */
export interface HttpRequestDraft {
  /** HTTP method entered by the user. */ method: string;
  /** Request URL before variable substitution and query-row appending. */ url: string;
  /** Ordered query-string rows. */ query?: HttpKeyValue[];
  /** Ordered request-header rows; duplicate names are preserved. */ headers?: HttpKeyValue[];
  /** Raw/JSON body text for text-oriented body modes. */ body?: string;
  /** Requested Content-Type for applicable body modes. */ contentType?: string;
  /** Active API Client body editor mode. */ bodyMode?: HttpBodyMode;
  /** Form fields used for `application/x-www-form-urlencoded`. */ urlencoded?: HttpKeyValue[];
  /** Multipart/form-data fields. */ formData?: HttpFormDataEntry[];
  /** Binary body selection. */ binary?: HttpBinaryBody;
  /** GraphQL query and variables. */ graphql?: HttpGraphqlBody;
  /** Authentication applied when the request is built/executed. */ auth?: HttpAuth;
  /** Server-side execution selections such as cookie jar or client certificate. */ hostExecution?: HttpHostExecutionSelection;
}

/** Named `{{variable}}` values available during request resolution. */
export type HttpVariables = Record<string, string>;

/** Options controlling arbitrary HTTP request construction. */
export interface HttpRequestBuildOptions {
  /** Values substituted into `{{variable}}` placeholders before request construction. */ variables?: HttpVariables;
}

/** Built request retaining ordered headers in addition to the legacy record representation. */
export interface HttpBuiltRequest extends BuiltRequest {
  /** Canonical ordered header list used for execution so duplicate header names survive. */ headerEntries: Array<[string, string]>;
}

/**
 * Build a transport request from an arbitrary HTTP draft, resolving `{{variable}}` placeholders.
 * @param draft Editable API Client request.
 * @param options Variable-resolution options.
 * @returns Fetch-ready request with ordered header entries.
 */
export function buildHttpRequest(draft: HttpRequestDraft, options: HttpRequestBuildOptions = {}): HttpBuiltRequest {
  return coreBuildHttpRequest(draft, options) as HttpBuiltRequest;
}

/**
 * Infer the body editor mode from draft fields.
 * @param draft Partial request draft to inspect.
 * @returns Explicit body mode when set, otherwise a mode inferred from populated body fields/content type.
 */
export function inferHttpBodyMode(draft: Partial<HttpRequestDraft>): HttpBodyMode {
  return coreInferHttpBodyMode(draft) as HttpBodyMode;
}

/**
 * Return host-execution capabilities required by the draft.
 * @param draft Request draft to inspect for browser-incompatible auth/cookie/certificate needs.
 * @returns Deduplicated required capability identifiers.
 */
export function httpHostExecutionRequirements(draft: Partial<HttpRequestDraft>): HttpHostExecutionCapability[] {
  return coreHttpHostExecutionRequirements(draft) as HttpHostExecutionCapability[];
}

/**
 * Resolve variables in a draft without mutating the input.
 * @param draft Source request draft.
 * @param variables Values substituted into `{{name}}` placeholders throughout request/auth fields.
 * @returns Cloned request draft containing resolved values.
 */
export function resolveHttpRequestDraftVariables(draft: HttpRequestDraft, variables: HttpVariables): HttpRequestDraft {
  return coreResolveHttpRequestDraftVariables(draft, variables) as HttpRequestDraft;
}

/**
 * Convert a built request into an editable API Client draft.
 * @param request Canonical built request, optionally retaining ordered header entries.
 * @returns Editable draft with URL query parameters and body mode reconstructed where possible.
 */
export function requestDraftFromBuiltRequest(request: BuiltRequest & { headerEntries?: Array<[string, string]> }): HttpRequestDraft {
  return coreRequestDraftFromBuiltRequest(request) as HttpRequestDraft;
}
