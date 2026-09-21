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
  FlexDocHostExecutionInstanceMode,
  FlexDocHostExecutionSessionCookie,
  FlexDocHostExecutionSessionStore,
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
export { createHostExecutionState, createInProcessHostExecutionSessionStore, executeHostRequest, publicHostExecutionOptions } from './host-execution';
export { parseHostExecutionRequestBody, runHostCookiesRoute, runHostExecutionRoute } from './host-execution-route';
export { createHostExecutionAdmission, createHostExecutionAdmissionMiddleware } from './host-execution-admission';
export { mergeHostExecutionObservationDocuments, mergeHostExecutionObservationReports } from './host-execution-fleet';
export type {
  FlexDocHostExecutionFleetConcurrency,
  FlexDocHostExecutionFleetDurations,
  FlexDocHostExecutionFleetGap,
  FlexDocHostExecutionFleetInstanceDurations,
  FlexDocHostExecutionFleetReport,
  FlexDocHostExecutionFleetTotals,
} from './host-execution-fleet';
export type {
  FlexDocHostExecutionAdmission,
  FlexDocHostExecutionAdmissionBudget,
  FlexDocHostExecutionAdmissionMiddlewareOptions,
  FlexDocHostExecutionAdmissionOptions,
  FlexDocHostExecutionAdmissionResponse,
} from './host-execution-admission';
export {
  createHostExecutionAdmissionRejectionMetricUpdate,
  createHostExecutionCompleteMetricUpdates,
  createHostExecutionStartMetricUpdates,
  createHostExecutionUnmarkedMetricUpdate,
} from './host-execution-metrics';
export type {
  FlexDocHostExecutionMetricKind,
  FlexDocHostExecutionMetricName,
  FlexDocHostExecutionMetricSink,
  FlexDocHostExecutionMetricUpdate,
  FlexDocHostExecutionRejectionSource,
} from './host-execution-metrics';
export {
  createHostExecutionCompleteEvent,
  createHostExecutionStartEvent,
  hostExecutionReasons,
  isHostExecutionReason,
} from './host-execution-observability';
export type {
  CreateHostExecutionCompleteEventInput,
  CreateHostExecutionStartEventInput,
  FlexDocHostExecutionCompleteEvent,
  FlexDocHostExecutionEvent,
  FlexDocHostExecutionEventBase,
  FlexDocHostExecutionEventName,
  FlexDocHostExecutionEventSink,
  FlexDocHostExecutionOutcome,
  FlexDocHostExecutionReason,
  FlexDocHostExecutionStartEvent,
} from './host-execution-observability';
export { createHostExecutionObservationRecorder, createHostExecutionObservationReport } from './host-execution-observation';
export type {
  CreateHostExecutionObservationRecorderOptions,
  FlexDocHostExecutionDurationSummary,
  FlexDocHostExecutionObservation,
  FlexDocHostExecutionObservationGap,
  FlexDocHostExecutionObservationRecorder,
  FlexDocHostExecutionObservationReport,
  FlexDocHostExecutionOutcomeCounts,
} from './host-execution-observation';
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