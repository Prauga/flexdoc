/** Logo shown in the documentation top bar. */
export interface LogoOptions {
  url: string;
  backgroundColor?: string;
  padding?: string | { vertical?: string | number; horizontal?: string | number };
  maxHeight?: string | number;
  maxWidth?: string | number;
  alt?: string;
  containerClass?: string;
  clickable?: boolean;
}

/** Theme tokens applied to renderer chrome and code blocks. */
export interface ThemeConfig {
  colors?: {
    primary?: { main?: string; light?: string; dark?: string };
    success?: { main?: string; light?: string; dark?: string };
    error?: { main?: string; light?: string; dark?: string };
    text?: { primary?: string; secondary?: string };
    gray?: { 50?: string; 100?: string };
    border?: { dark?: string; light?: string };
  };
  typography?: {
    fontSize?: string;
    lineHeight?: string;
    fontFamily?: string;
    headings?: { fontFamily?: string; fontWeight?: string };
    code?: {
      fontSize?: string;
      fontFamily?: string;
      lineHeight?: string;
      color?: string;
      backgroundColor?: string;
      wrap?: boolean;
    };
  };
  sidebar?: {
    backgroundColor?: string;
    backgroundColorDark?: string;
    textColor?: string;
    textColorDark?: string;
    activeTextColor?: string;
    activeTextColorDark?: string;
    borderColor?: string;
    borderColorDark?: string;
    groupItems?: { textTransform?: string };
  };
  methodColors?: Record<string, { bg?: string; border?: string }>;
}

/** Section identifiers used by expand presets and custom expand arrays. */
export type ExpandSection = 'parameters' | 'requestBody' | 'responses' | 'tryIt' | 'codeSamples';
/** Built-in expand presets for operation detail panels. */
export type ExpandPreset = 'all' | 'none' | 'minimal' | 'documentation' | 'interactive';
/** Expand preset or explicit list of sections/presets to open by default. */
export type ExpandOption = ExpandPreset | Array<ExpandSection | Exclude<ExpandPreset, 'all' | 'none'>>;
export type FlexDocViewerTheme = 'light' | 'dark' | 'high-contrast';

/**
 * Renderer-owned chrome translations. Hosts can override any entry while
 * OpenAPI-authored summaries/descriptions remain sourced from the spec.
 */
export interface FlexDocMessages {
  parameters?: string;
  requestBody?: string;
  responses?: string;
  tryIt?: string;
  codeExamples?: string;
  tryItBasic?: string;
  tryItAdvanced?: string;
  openApiClient?: string;
  apiClient?: string;
  backToOperation?: string;
  environment?: string;
  noEnvironment?: string;
  unsavedChanges?: string;
  sendRequest?: string;
  cancelRequest?: string;
  requestCancelled?: string;
  openOverview?: string;
  openSettings?: string;
  openRuntime?: string;
  commandPalette?: string;
  closeCommandPalette?: string;
  searchCommands?: string;
  searchCommandsPlaceholder?: string;
  commandResults?: string;
  noCommandResults?: string;
  sendCurrentRequest?: string;
  searchEndpoints?: string;
  searchEndpointsPlaceholder?: string;
  apiInformation?: string;
  versionLabel?: string;
  servers?: string;
  endpoints?: string;
  noEndpointsMatch?: string;
  generalTag?: string;
  apiNavigation?: string;
  closeApiNavigation?: string;
  runtimeIntelligence?: string;
  runtimeIntelligenceDescription?: string;
  closeRuntimeIntelligence?: string;
  closeRuntimeIntelligencePanel?: string;
  inspectingRuntimeRoutes?: string;
  framework?: string;
  matched?: string;
  runtime?: string;
  runtimeServer?: string;
  backendListenerPort?: string;
  routeDiscoveryPartial?: string;
  implementedButUndocumented?: string;
  noUndocumentedRuntimeRoutes?: string;
  documentedButNotObserved?: string;
  everyDocumentedRouteObserved?: string;
  runtimeAligned?: string;
  openRuntimeRoute?: string;
  unusualBodyAdvisory?: string;
  unusualBodyHostExecution?: string;
  unusualBodyBrowserWarning?: string;
  hostBrowserUnsupported?: string;
  hostExecutionDisabled?: string;
  hostExecutionStatus?: string;
  viewerTheme?: string;
  lightTheme?: string;
  darkTheme?: string;
  highContrast?: string;
  printOperation?: string;
  downloadFailed?: string;
}

/** Capability flags advertised when API-host execution is enabled on the docs server. */
export type FlexDocHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';
/** Public host-execution metadata serialized to the browser renderer. */
export interface FlexDocHostExecutionPublicOptions {
  available: boolean;
  endpoint: string;
  capabilities: FlexDocHostExecutionCapability[];
  clientCertificates?: Array<{ id: string; name: string }>;
  cookiesEndpoint?: string;
}

export interface FlexDocRuntimeRoute { method: string; path: string; }
export interface FlexDocRuntimeMetadata { name: string; version: string; platform: string; arch: string; }
export interface FlexDocRuntimeServerMetadata { localPort?: number; }
export interface FlexDocRuntimeEnvironmentMetadata { name: string; }
/** Snapshot comparing documented OpenAPI routes with routes discovered at runtime. */
export interface FlexDocRuntimeIntelligenceSnapshot {
  framework: string;
  frameworkVersion?: string;
  runtime: FlexDocRuntimeMetadata;
  serverOrigin?: string;
  server?: FlexDocRuntimeServerMetadata;
  environment?: FlexDocRuntimeEnvironmentMetadata;
  discoveryComplete: boolean;
  routes: FlexDocRuntimeRoute[];
  runtimeOnly: FlexDocRuntimeRoute[];
  documentedOnly: FlexDocRuntimeRoute[];
  summary: { documented: number; runtime: number; matched: number; runtimeOnly: number; documentedOnly: number };
}
/** Public runtime-intelligence endpoint metadata exposed to the renderer. */
export interface FlexDocRuntimeIntelligencePublicOptions { available: boolean; endpoint: string; framework: string; }

/** Renderer options passed to `FlexDoc` through the `options` prop. */
export interface FlexDocRendererOptions {
  contractVersion?: '1';
  title?: string;
  description?: string;
  altDescription?: string;
  version?: string;
  tagGroups?: Array<{ name: string; tags: string[] }>;
  theme?: 'light' | 'dark' | ThemeConfig;
  /** BCP 47 locale applied to renderer-owned chrome and operation content. */
  locale?: string;
  /** Host-provided renderer chrome translations. Omitted keys keep the built-in English copy. */
  messages?: FlexDocMessages;
  customCss?: string;
  customJs?: string;
  favicon?: string;
  logo?: string | LogoOptions;
  hideDownloadButton?: boolean;
  hideTopbar?: boolean;
  /** Default endpoint sections to expand. Viewer preferences override this host default. */
  expand?: ExpandOption;
  /** @deprecated Use `expand` instead. Explicit legacy values retain the pre-expand default behavior. */
  expandResponses?: string;
  defaultModelsExpandDepth?: number;
  showExtensions?: boolean;
  showCommonExtensions?: boolean;
  hideHostname?: boolean;
  hideLoading?: boolean;
  nativeScrollbars?: boolean;
  pathInMiddlePanel?: boolean;
  requiredPropsFirst?: boolean;
  sortPropsAlphabetically?: boolean;
  showRequestHeaders?: boolean;
  noAutoAuth?: boolean;
  lazyRendering?: boolean;
  scrollYOffset?: number | string;
  suppressWarnings?: boolean;
  payloadSampleIdx?: number;
  runtimeIntelligence?: FlexDocRuntimeIntelligencePublicOptions;
  tryIt?: {
    enabled?: boolean;
    defaultServer?: string;
    credentials?: RequestCredentials;
    requestInterceptor?: (request: RequestInit & { url: string }) => Promise<RequestInit & { url: string }> | (RequestInit & { url: string });
    apiClientPersistenceKey?: string | false;
    hostExecution?: FlexDocHostExecutionPublicOptions;
  };
  codeSamples?: {
    enabled?: boolean;
    languages?: Array<'curl' | 'javascript' | 'python' | 'go' | 'java'>;
  };
  footer?: {
    copyright?: string;
    link?: Array<{ text: string; url: string; icon?: string }>;
  };
}
