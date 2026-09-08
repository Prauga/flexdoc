/**
 * @packageDocumentation
 * Canonical React renderer, API Client components, and OpenAPI utilities for FlexDoc.
 *
 * Import from `@prauga/flexdoc-client` for documentation UI (`FlexDoc`), request
 * editing (`ApiClient`, `ApiClientWorkspace`), and programmatic OpenAPI/request helpers.
 */
import './styles.css';

export { FlexDoc } from './components/FlexDoc';
export { ApiClient } from './components/ApiClient';
export type { ApiClientExecutionResult, ApiClientProps } from './components/ApiClient';
export { ApiClientCodeEditor } from './components/ApiClientCodeEditor';
export type { ApiClientCodeEditorProps, ApiClientCodeLanguage } from './components/ApiClientCodeEditor';
export { ApiClientScriptEditor } from './components/ApiClientScriptEditor';
export type { ApiClientScriptEditorProps } from './components/ApiClientScriptEditor';
export { ApiClientHistoryPage } from './components/ApiClientHistoryPage';
export type { ApiClientHistoryPageProps } from './components/ApiClientHistoryPage';
export { ApiClientWorkspace } from './components/ApiClientWorkspace';
export type { ApiClientWorkspaceProps } from './components/ApiClientWorkspace';
export { App as ApiDocsDemo } from './App';
export type { AppProps } from './App';
export type { OpenAPISpec } from './types/openapi';
export type { FlexDocProps } from './components/FlexDoc';
export type {
  ExpandOption,
  ExpandPreset,
  ExpandSection,
  FlexDocCodeSampleLanguage,
  FlexDocCodeSampleOptions,
  FlexDocFooterLink,
  FlexDocFooterOptions,
  FlexDocHostExecutionCapability,
  FlexDocHostExecutionCertificateChoice,
  FlexDocHostExecutionPublicOptions,
  FlexDocInterceptedRequest,
  FlexDocMessages,
  FlexDocRendererOptions,
  FlexDocRuntimeEnvironmentMetadata,
  FlexDocRuntimeIntelligencePublicOptions,
  FlexDocRuntimeIntelligenceSnapshot,
  FlexDocRuntimeIntelligenceSummary,
  FlexDocRuntimeMetadata,
  FlexDocRuntimeRoute,
  FlexDocRuntimeServerMetadata,
  FlexDocTagGroup,
  FlexDocTryItOptions,
  FlexDocViewerTheme,
  LogoOptions,
  LogoPaddingOptions,
  ThemeBorderColors,
  ThemeCodeTypography,
  ThemeColorVariants,
  ThemeColors,
  ThemeConfig,
  ThemeGrayColors,
  ThemeHeadingTypography,
  ThemeMethodColors,
  ThemeSidebar,
  ThemeSidebarGroupItems,
  ThemeTextColors,
  ThemeTypography,
} from './types/options';
export { OpenAPIParser } from './utils/openapi-parser';
export { bundleExternalReferences, EXTERNAL_DOCUMENTS_KEY } from './utils/openapi-resolver';
export type { BundleOptions, DocumentLoader } from './utils/openapi-resolver';
export { normalizeOperation, resolveObject, resolvePathItem, resolveServerVariables } from './utils/openapi-normalizer';
export type { NormalizedOperation } from './utils/openapi-normalizer';
export { buildRequest, initialRequestValues, parametersFor } from './utils/request-builder';
export type { BuiltRequest, RequestValues, RequestValue } from './utils/request-builder';
export { createOpenApiApiClientSession } from './utils/openapi-api-client-session';
export type { OpenApiApiClientSession } from './utils/openapi-api-client-session';
export { buildHttpRequest, inferHttpBodyMode, requestDraftFromBuiltRequest, resolveHttpRequestDraftVariables } from './utils/http-client';
export { executeApiClientRequest } from './utils/api-client-execution';
export { apiClientCollectionRunName, apiClientCollectionRunRequests, runApiClientCollection } from './utils/api-client-runner';
export type { ApiClientCollectionRunItem, ApiClientCollectionRunResult, RunApiClientCollectionOptions } from './utils/api-client-runner';
export type { ApiClientExecutionOutcome, ApiClientExecutionResponse, ExecuteApiClientRequestOptions } from './utils/api-client-execution';
export type {
  HttpApiKeyAuth,
  HttpAuth,
  HttpAwsV4Auth,
  HttpBasicAuth,
  HttpBearerAuth,
  HttpBinaryBody,
  HttpBodyMode,
  HttpBuiltRequest,
  HttpDigestAuth,
  HttpFormDataEntry,
  HttpGraphqlBody,
  HttpHawkAuth,
  HttpHostExecutionCapability,
  HttpHostExecutionSelection,
  HttpInheritedAuth,
  HttpKeyValue,
  HttpNoAuth,
  HttpNtlmAuth,
  HttpOAuth1Auth,
  HttpOAuth2Auth,
  HttpOAuth2GrantType,
  HttpRequestBuildOptions,
  HttpRequestDraft,
  HttpVariables,
} from './utils/http-client';
export { cloneApiClientScripts, EMPTY_API_CLIENT_SCRIPTS, runApiClientScript } from './utils/api-client-scripting';
export { API_CLIENT_SCRIPT_COMPLETION_PATHS, apiClientScriptCompletionsAtPosition, apiClientScriptMemberCompletions, apiClientScriptVariableKeyCompletions } from './utils/api-client-script-intellisense';
export type { ApiClientScriptCompletionContext, ApiClientScriptCompletionItem, ApiClientScriptCompletionKind, ApiClientScriptPhase, ApiClientScriptVariableKeys } from './utils/api-client-script-intellisense';
export type {
  ApiClientRequestScripts,
  ApiClientScriptEnvironmentChange,
  ApiClientScriptResponse,
  ApiClientScriptRunResult,
  ApiClientScriptTestResult,
} from './utils/api-client-scripting';
export {
  importPostmanCollection,
  importPostmanDocument,
  importPostmanEnvironment,
  mergePostmanCollectionImport,
  mergePostmanEnvironmentImport,
} from './utils/api-client-postman';
export type {
  ApiClientImportWarning,
  PostmanCollectionImportResult,
  PostmanDocumentImportResult,
  PostmanEnvironmentImportResult,
} from './utils/api-client-postman';
export type {
  ApiClientCollection,
  ApiClientEnvironment,
  ApiClientEnvironmentVariable,
  ApiClientFolder,
  ApiClientHistoryEntry,
  ApiClientHistoryInput,
  ApiClientSavedRequest,
  ApiClientWorkspaceState,
} from './utils/api-client-workspace';
export { generateCodeSample, languageLabel } from './utils/code-samples';
export type { CodeSampleLanguage } from './utils/code-samples';
export { sampleSpec } from './data/sample-spec';
