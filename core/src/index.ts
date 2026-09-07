/**
 * @packageDocumentation
 * Framework-neutral OpenAPI engine for FlexDoc request construction, resolution, and serialization.
 *
 * Shared by `@prauga/flexdoc-client`, `@prauga/flexdoc-cli`, and backend integrations.
 * Has no React dependency and does not render UI.
 */
export * from './types/openapi.js';
export { OpenAPIParser } from './openapi-parser.js';
export { bundleExternalReferences, EXTERNAL_DOCUMENTS_KEY } from './openapi-resolver.js';
export type { BundleOptions, DocumentLoader } from './openapi-resolver.js';
export { normalizeOperation, resolveObject, resolvePathItem, resolveServerVariables } from './openapi-normalizer.js';
export type { NormalizedOperation } from './openapi-normalizer.js';
export { buildRequest, initialRequestValues, operationFor, parametersFor } from './request-builder.js';
export type { BuiltRequest, RequestValue, RequestValues } from './request-builder.js';
export { buildHttpRequest, httpHostExecutionRequirements, inferHttpBodyMode, requestDraftFromBuiltRequest, resolveHttpRequestDraftVariables } from './http-client.js';
export type { HttpAuth, HttpAwsV4Auth, HttpBinaryBody, HttpBodyMode, HttpDigestAuth, HttpFormDataEntry, HttpGraphqlBody, HttpHawkAuth, HttpHostExecutionCapability, HttpHostExecutionSelection, HttpKeyValue, HttpNtlmAuth, HttpOAuth1Auth, HttpRequestBuildOptions, HttpRequestDraft, HttpVariables } from './http-client.js';
export { generateCodeSample, languageLabel } from './code-samples.js';
export type { CodeSampleLanguage } from './code-samples.js';
