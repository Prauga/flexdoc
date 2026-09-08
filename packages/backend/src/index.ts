/**
 * @packageDocumentation
 * Thin self-hosted FlexDoc integrations for Express, Fastify, NestJS, and Hono.
 *
 * Mount the renderer, optional API-host execution routes, and runtime intelligence
 * endpoints with `setupFlexDoc` or a framework-specific `setup*FlexDoc` helper.
 */
export { FlexDocModule } from './flexdoc.module';
export { FlexDocService } from './flexdoc.service';
export type {
  ExpandOption,
  ExpandPreset,
  ExpandSection,
  FlexDocCodeSampleLanguage,
  FlexDocCodeSampleOptions,
  FlexDocDocumentationAuthOptions,
  FlexDocFooterLink,
  FlexDocFooterOptions,
  FlexDocHostExecutionCapability,
  FlexDocHostExecutionCertificate,
  FlexDocHostExecutionCertificateChoice,
  FlexDocHostExecutionOptions,
  FlexDocHostExecutionPublicOptions,
  FlexDocHostExecutionRequest,
  FlexDocModuleOptions,
  FlexDocOptions,
  FlexDocRuntimeIntelligenceOptions,
  FlexDocRuntimeIntelligencePublicOptions,
  FlexDocTagGroup,
  FlexDocTryItOptions,
  LogoOptions,
  LogoPaddingOptions,
  MethodColors,
  ThemeBorderColors,
  ThemeCodeTypography,
  ThemeColorVariants,
  ThemeColors,
  ThemeConfig,
  ThemeGrayColors,
  ThemeHeadingTypography,
  ThemeMethodColor,
  ThemeSidebar,
  ThemeSidebarGroupItems,
  ThemeTextColors,
  ThemeTypography,
} from './interfaces';
export { setupFlexDoc } from './setup';
export { setupExpressFlexDoc, setupFastifyFlexDoc, setupFastifySwaggerFlexDoc, setupNestFlexDoc } from './framework-adapters';
export type { ExpressLikeApplication, FastifyLikeApplication, FastifyLikeReply, FastifyLikeRequest, NestLikeApplication } from './framework-adapters';
export { setupHonoFlexDoc } from './hono-adapter';
export { createHostExecutionState, executeHostRequest, publicHostExecutionOptions } from './host-execution';
export { parseHostExecutionRequestBody, runHostCookiesRoute, runHostExecutionRoute } from './host-execution-route';
export { validateRuntimeContract } from './contract-validation';
export type {
  FlexDocContractDuplicateRuntimeRoute,
  FlexDocContractRoute,
  FlexDocContractValidationCode,
  FlexDocContractValidationFinding,
  FlexDocContractValidationLocation,
  FlexDocContractValidationResult,
  FlexDocContractValidationSeverity,
  FlexDocContractValidationStatus,
  FlexDocContractValidationSummary,
  ValidateRuntimeContractOptions,
} from './contract-validation';
export { buildRuntimeIntelligenceSnapshot, discoverExpressRoutes, discoverFastifyRoutes, discoverHonoRoutes, documentedOpenApiRoutes, nodeRuntimeMetadata, normalizeRuntimePath } from './runtime-intelligence';
export type { FlexDocRuntimeDiscovery, FlexDocRuntimeDuplicateRoute, FlexDocRuntimeIntelligenceSnapshot, FlexDocRuntimeMetadata, FlexDocRuntimeRoute } from './runtime-intelligence';
export type { HonoLikeApplication, HonoLikeContext } from './hono-adapter';
