/** Separate vertical/horizontal padding values for a renderer logo container. */
export interface LogoPaddingOptions {
  /** Vertical CSS padding. Numeric values are interpreted as pixels. */ vertical?: string | number;
  /** Horizontal CSS padding. Numeric values are interpreted as pixels. */ horizontal?: string | number;
}

/** Logo shown in the documentation top bar. */
export interface LogoOptions {
  /** Image URL loaded for the logo. */ url: string;
  /** Background color applied to the logo container. */ backgroundColor?: string;
  /** CSS padding for the logo container, or separate vertical/horizontal values. */ padding?: string | LogoPaddingOptions;
  /** Maximum rendered logo height. Numeric values are interpreted as pixels. */ maxHeight?: string | number;
  /** Maximum rendered logo width. Numeric values are interpreted as pixels. */ maxWidth?: string | number;
  /** Alternative text used by the logo image. */ alt?: string;
  /** Additional CSS class applied to the logo container. */ containerClass?: string;
  /** Whether the logo behaves as a navigation control when a destination is available. */ clickable?: boolean;
}

/** Main/light/dark variants for one semantic renderer color. */
export interface ThemeColorVariants {
  /** Default color value. */ main?: string;
  /** Lighter color variant. */ light?: string;
  /** Darker color variant. */ dark?: string;
}

/** Renderer text-color tokens. */
export interface ThemeTextColors {
  /** Primary foreground text color. */ primary?: string;
  /** Secondary/muted foreground text color. */ secondary?: string;
}

/** Neutral gray tokens used by renderer surfaces. */
export interface ThemeGrayColors {
  /** Very light neutral surface token. */ 50?: string;
  /** Light neutral surface token. */ 100?: string;
}

/** Theme-aware renderer border colors. */
export interface ThemeBorderColors {
  /** Border color used by dark renderer surfaces. */ dark?: string;
  /** Border color used by light renderer surfaces. */ light?: string;
}

/** Semantic renderer color-token overrides. */
export interface ThemeColors {
  /** Primary brand/accent color variants. */ primary?: ThemeColorVariants;
  /** Success-state color variants. */ success?: ThemeColorVariants;
  /** Error-state color variants. */ error?: ThemeColorVariants;
  /** Primary and secondary text colors. */ text?: ThemeTextColors;
  /** Neutral gray tokens used by light renderer surfaces. */ gray?: ThemeGrayColors;
  /** Border colors for dark and light themes. */ border?: ThemeBorderColors;
}

/** Heading typography overrides. */
export interface ThemeHeadingTypography {
  /** Font family used by headings. */ fontFamily?: string;
  /** CSS font-weight value used by headings. */ fontWeight?: string;
}

/** Code block/editor typography and surface overrides. */
export interface ThemeCodeTypography {
  /** Code font size. */ fontSize?: string;
  /** Code font family. */ fontFamily?: string;
  /** Code line height. */ lineHeight?: string;
  /** Code foreground color. */ color?: string;
  /** Code background color. */ backgroundColor?: string;
  /** Whether long code lines soft-wrap. */ wrap?: boolean;
}

/** Typography tokens for renderer text, headings, and code. */
export interface ThemeTypography {
  /** Base renderer font size. */ fontSize?: string;
  /** Base renderer line height. */ lineHeight?: string;
  /** Base renderer font family. */ fontFamily?: string;
  /** Heading-specific font overrides. */ headings?: ThemeHeadingTypography;
  /** Code block/editor typography and wrapping overrides. */ code?: ThemeCodeTypography;
}

/** Styling applied to grouped navigation labels. */
export interface ThemeSidebarGroupItems {
  /** CSS `text-transform` value applied to group labels. */ textTransform?: string;
}

/** Sidebar-specific renderer theme tokens. */
export interface ThemeSidebar {
  /** Sidebar background in light mode. */ backgroundColor?: string;
  /** Sidebar background in dark mode. */ backgroundColorDark?: string;
  /** Sidebar text color in light mode. */ textColor?: string;
  /** Sidebar text color in dark mode. */ textColorDark?: string;
  /** Active sidebar item text color in light mode. */ activeTextColor?: string;
  /** Active sidebar item text color in dark mode. */ activeTextColorDark?: string;
  /** Sidebar border color in light mode. */ borderColor?: string;
  /** Sidebar border color in dark mode. */ borderColorDark?: string;
  /** Styling applied to grouped navigation labels. */ groupItems?: ThemeSidebarGroupItems;
}

/** Background/border colors for one HTTP-method badge. */
export interface ThemeMethodColors {
  /** Badge background color. */ bg?: string;
  /** Badge border color. */ border?: string;
}

/** Theme tokens applied to renderer chrome and code blocks. */
export interface ThemeConfig {
  /** Color tokens for renderer chrome, text, borders, and status states. */ colors?: ThemeColors;
  /** Typography tokens for general text, headings, and code. */ typography?: ThemeTypography;
  /** Sidebar-specific theme tokens. */ sidebar?: ThemeSidebar;
  /** Per-HTTP-method badge colors keyed by lowercase method name. */ methodColors?: Record<string, ThemeMethodColors>;
}

/** Section identifiers used by expand presets and custom expand arrays. */
export type ExpandSection = 'parameters' | 'requestBody' | 'responses' | 'tryIt' | 'codeSamples';
/** Built-in expand presets for operation detail panels. */
export type ExpandPreset = 'all' | 'none' | 'minimal' | 'documentation' | 'interactive';
/** Expand preset or explicit list of sections/presets to open by default. */
export type ExpandOption = ExpandPreset | Array<ExpandSection | Exclude<ExpandPreset, 'all' | 'none'>>;
/** Viewer-selectable renderer theme preference. */
export type FlexDocViewerTheme = 'light' | 'dark' | 'high-contrast';

/**
 * Renderer-owned chrome translations. Hosts can override any entry while
 * OpenAPI-authored summaries/descriptions remain sourced from the spec.
 */
export interface FlexDocMessages {
  /** Label for operation parameters. */ parameters?: string;
  /** Label for an operation request body. */ requestBody?: string;
  /** Label for operation responses. */ responses?: string;
  /** Label for the Try It area. */ tryIt?: string;
  /** Label for generated code examples. */ codeExamples?: string;
  /** Label for Basic Try It mode. */ tryItBasic?: string;
  /** Label for Advanced Try It mode. */ tryItAdvanced?: string;
  /** Action text for opening the current operation in API Client. */ openApiClient?: string;
  /** Label for the API Client workspace. */ apiClient?: string;
  /** Action text for returning from API Client to the operation page. */ backToOperation?: string;
  /** Label for the active API Client environment. */ environment?: string;
  /** Copy shown when no API Client environment is active. */ noEnvironment?: string;
  /** Indicator text for unsaved API Client edits. */ unsavedChanges?: string;
  /** Action text for sending the current request. */ sendRequest?: string;
  /** Action text for cancelling an in-flight request. */ cancelRequest?: string;
  /** Status text shown after request cancellation. */ requestCancelled?: string;
  /** Command/action text for opening the API overview. */ openOverview?: string;
  /** Command/action text for opening renderer settings. */ openSettings?: string;
  /** Command/action text for opening Runtime Intelligence. */ openRuntime?: string;
  /** Label for the command palette. */ commandPalette?: string;
  /** Accessible label for closing the command palette. */ closeCommandPalette?: string;
  /** Label for command search. */ searchCommands?: string;
  /** Placeholder for command search input. */ searchCommandsPlaceholder?: string;
  /** Accessible label for the command result list. */ commandResults?: string;
  /** Empty-state text when command search has no matches. */ noCommandResults?: string;
  /** Command text for sending the current API Client request. */ sendCurrentRequest?: string;
  /** Label for endpoint navigation search. */ searchEndpoints?: string;
  /** Placeholder for endpoint navigation search. */ searchEndpointsPlaceholder?: string;
  /** Heading for API metadata shown in navigation. */ apiInformation?: string;
  /** Label preceding the API version. */ versionLabel?: string;
  /** Label for OpenAPI servers. */ servers?: string;
  /** Label for endpoint navigation. */ endpoints?: string;
  /** Empty-state text when endpoint search has no matches. */ noEndpointsMatch?: string;
  /** Fallback label for untagged operations. */ generalTag?: string;
  /** Accessible label for the API navigation region. */ apiNavigation?: string;
  /** Accessible label for closing API navigation on compact layouts. */ closeApiNavigation?: string;
  /** Heading for Runtime Intelligence. */ runtimeIntelligence?: string;
  /** Supporting copy describing Runtime Intelligence. */ runtimeIntelligenceDescription?: string;
  /** Action text for closing Runtime Intelligence. */ closeRuntimeIntelligence?: string;
  /** Accessible label for the Runtime Intelligence close control. */ closeRuntimeIntelligencePanel?: string;
  /** Status text shown while runtime routes are being inspected. */ inspectingRuntimeRoutes?: string;
  /** Label for the detected backend framework. */ framework?: string;
  /** Label for routes matched between runtime and OpenAPI. */ matched?: string;
  /** Label for runtime route totals/metadata. */ runtime?: string;
  /** Label for the observed runtime server origin. */ runtimeServer?: string;
  /** Label for the observed backend listener port. */ backendListenerPort?: string;
  /** Warning shown when route discovery is known to be partial. */ routeDiscoveryPartial?: string;
  /** Heading for runtime routes implemented but missing from OpenAPI. */ implementedButUndocumented?: string;
  /** Empty-state copy when no undocumented runtime routes are found. */ noUndocumentedRuntimeRoutes?: string;
  /** Heading for documented routes not observed at runtime. */ documentedButNotObserved?: string;
  /** Empty-state copy when all documented routes are observed. */ everyDocumentedRouteObserved?: string;
  /** Status text shown when runtime and documented routes align. */ runtimeAligned?: string;
  /** Action text for opening a runtime route's documentation when available. */ openRuntimeRoute?: string;
  /** Advisory heading for HTTP methods with unusual request bodies. */ unusualBodyAdvisory?: string;
  /** Copy explaining that API-host execution can preserve an unusual body. */ unusualBodyHostExecution?: string;
  /** Copy warning that browser transport may reject an unusual body. */ unusualBodyBrowserWarning?: string;
  /** Error shown when a requested host-execution capability is unavailable. */ hostBrowserUnsupported?: string;
  /** Error shown when API-host execution is disabled. */ hostExecutionDisabled?: string;
  /** Status label for API-host execution. */ hostExecutionStatus?: string;
  /** Label for renderer theme selection. */ viewerTheme?: string;
  /** Label for light viewer theme. */ lightTheme?: string;
  /** Label for dark viewer theme. */ darkTheme?: string;
  /** Label for high-contrast viewer theme. */ highContrast?: string;
  /** Action text for printing an operation. */ printOperation?: string;
  /** Error shown when a documentation/spec download fails. */ downloadFailed?: string;
}

/** Capability flags advertised when API-host execution is enabled on the docs server. */
export type FlexDocHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';

/** Safe server-side certificate choice advertised to the browser. */
export interface FlexDocHostExecutionCertificateChoice {
  /** Stable server-side certificate identifier sent back when the user selects it. */ id: string;
  /** Human-readable certificate name displayed by API Client. */ name: string;
}

/** Public host-execution metadata serialized to the browser renderer. */
export interface FlexDocHostExecutionPublicOptions {
  /** Whether the documentation host currently exposes an execution endpoint. */ available: boolean;
  /** Same-origin endpoint that accepts FlexDoc host-execution requests. */ endpoint: string;
  /** Transport/authentication capabilities implemented by the host. */ capabilities: FlexDocHostExecutionCapability[];
  /** Safe certificate identifiers/names available for client-certificate selection; private key material is never serialized. */ clientCertificates?: FlexDocHostExecutionCertificateChoice[];
  /** Same-origin endpoint used to inspect or clear the host-side cookie jar. */ cookiesEndpoint?: string;
}

/** One runtime route observed by a backend adapter. */
export interface FlexDocRuntimeRoute {
  /** Uppercase HTTP method. */ method: string;
  /** Normalized route path/template. */ path: string;
}

/** Runtime process metadata safe to expose to documentation viewers. */
export interface FlexDocRuntimeMetadata {
  /** Runtime name, such as Node.js. */ name: string;
  /** Runtime version string. */ version: string;
  /** Operating-system platform identifier. */ platform: string;
  /** Process architecture identifier. */ arch: string;
}

/** Observed server-listener metadata. */
export interface FlexDocRuntimeServerMetadata {
  /** Local listener port when the adapter can determine it. */ localPort?: number;
}

/** Safe environment metadata exposed by Runtime Intelligence. */
export interface FlexDocRuntimeEnvironmentMetadata {
  /** Environment name supplied by or inferred by the host integration. */ name: string;
}

/** Aggregate route counts in a Runtime Intelligence snapshot. */
export interface FlexDocRuntimeIntelligenceSummary {
  /** Number of HTTP operations present in the OpenAPI document. */ documented: number;
  /** Number of routes discovered in the running backend. */ runtime: number;
  /** Number of routes observed in both OpenAPI and the running backend. */ matched: number;
  /** Number of runtime routes missing from OpenAPI. */ runtimeOnly: number;
  /** Number of OpenAPI operations not observed at runtime. */ documentedOnly: number;
}

/** Snapshot comparing documented OpenAPI routes with routes discovered at runtime. */
export interface FlexDocRuntimeIntelligenceSnapshot {
  /** Framework identifier used by the adapter. */ framework: string;
  /** Detected framework version when available. */ frameworkVersion?: string;
  /** Runtime/process metadata. */ runtime: FlexDocRuntimeMetadata;
  /** Origin inferred for the backend listener handling documentation requests. */ serverOrigin?: string;
  /** Listener metadata collected by the adapter. */ server?: FlexDocRuntimeServerMetadata;
  /** Safe environment metadata collected by the adapter. */ environment?: FlexDocRuntimeEnvironmentMetadata;
  /** Whether the adapter believes route discovery covers the complete application route set. */ discoveryComplete: boolean;
  /** All runtime routes observed by the adapter after FlexDoc routes are excluded. */ routes: FlexDocRuntimeRoute[];
  /** Runtime routes that do not have a matching OpenAPI operation. */ runtimeOnly: FlexDocRuntimeRoute[];
  /** OpenAPI operations that were not observed in the runtime route set. */ documentedOnly: FlexDocRuntimeRoute[];
  /** Aggregate route counts for quick status rendering. */ summary: FlexDocRuntimeIntelligenceSummary;
}

/** Public runtime-intelligence endpoint metadata exposed to the renderer. */
export interface FlexDocRuntimeIntelligencePublicOptions {
  /** Whether a Runtime Intelligence endpoint is available. */ available: boolean;
  /** Same-origin endpoint returning a runtime snapshot. */ endpoint: string;
  /** Framework identifier expected in snapshots from the endpoint. */ framework: string;
}

/** One explicit navigation tag group. */
export interface FlexDocTagGroup {
  /** Group name displayed in navigation. */ name: string;
  /** Ordered OpenAPI tag names included in the group. */ tags: string[];
}

/** Request passed to a direct-browser Try It interceptor. */
export interface FlexDocInterceptedRequest extends RequestInit {
  /** Absolute URL that will be passed to Fetch after interception. */ url: string;
}

/** Try It and sibling API Client behavior. */
export interface FlexDocTryItOptions {
  /** Enable operation-level Try It controls. */ enabled?: boolean;
  /** Default server URL selected for requests when OpenAPI offers multiple servers. */ defaultServer?: string;
  /** Browser Fetch credentials mode used for direct requests. */ credentials?: RequestCredentials;
  /** Hook invoked before direct browser execution; may rewrite URL or RequestInit fields. */
  requestInterceptor?: (request: FlexDocInterceptedRequest) => Promise<FlexDocInterceptedRequest> | FlexDocInterceptedRequest;
  /** IndexedDB workspace key used by the sibling API Client, or `false` to disable persistence. */ apiClientPersistenceKey?: string | false;
  /** API-host execution endpoint and capability metadata. */ hostExecution?: FlexDocHostExecutionPublicOptions;
}

/** Language identifiers accepted by renderer code-sample configuration. */
export type FlexDocCodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java';

/** Generated code-sample configuration. */
export interface FlexDocCodeSampleOptions {
  /** Enable generated request code samples. */ enabled?: boolean;
  /** Ordered languages shown in code-sample tabs. */ languages?: FlexDocCodeSampleLanguage[];
}

/** One footer navigation link. */
export interface FlexDocFooterLink {
  /** Link text displayed in the footer. */ text: string;
  /** Destination URL. */ url: string;
  /** Optional icon identifier understood by the renderer. */ icon?: string;
}

/** Footer content rendered below documentation. */
export interface FlexDocFooterOptions {
  /** Copyright/legal text shown in the footer. */ copyright?: string;
  /** Footer links displayed in their configured order. */ link?: FlexDocFooterLink[];
}

/** Renderer options passed to `FlexDoc` through the `options` prop. */
export interface FlexDocRendererOptions {
  /** Renderer-host contract version. FlexDoc 3.x currently uses contract `1`. */ contractVersion?: '1';
  /** Title overriding `spec.info.title` in renderer chrome. */ title?: string;
  /** Primary API description overriding the OpenAPI description when supplied. */ description?: string;
  /** Alternate/secondary description supported by host integrations. */ altDescription?: string;
  /** Version text overriding the OpenAPI API version in renderer chrome. */ version?: string;
  /** Explicit navigation tag groups and their ordered tag names. */ tagGroups?: FlexDocTagGroup[];
  /** Light/dark preset or custom renderer theme tokens. */ theme?: 'light' | 'dark' | ThemeConfig;
  /** BCP 47 locale applied to renderer-owned chrome and operation content. */ locale?: string;
  /** Host-provided renderer chrome translations. Omitted keys keep the built-in English copy. */ messages?: FlexDocMessages;
  /** Raw CSS appended to renderer styling. */ customCss?: string;
  /** Raw JavaScript executed by the standalone renderer host. */ customJs?: string;
  /** Favicon URL used by the generated documentation page. */ favicon?: string;
  /** Logo URL or structured logo customization. */ logo?: string | LogoOptions;
  /** Hide the OpenAPI/download action from renderer chrome. */ hideDownloadButton?: boolean;
  /** Hide the renderer top bar. */ hideTopbar?: boolean;
  /** Default endpoint sections to expand. Viewer preferences override this host default. */ expand?: ExpandOption;
  /** @deprecated Use `expand` instead. Explicit legacy values retain the pre-expand default behavior. */ expandResponses?: string;
  /** Legacy model/schema expansion depth used by compatible renderer views. */ defaultModelsExpandDepth?: number;
  /** Show OpenAPI specification extensions in documentation views. */ showExtensions?: boolean;
  /** Show commonly recognized extension fields. */ showCommonExtensions?: boolean;
  /** Hide the hostname/server portion of request URLs in applicable UI. */ hideHostname?: boolean;
  /** Suppress the renderer loading indicator. */ hideLoading?: boolean;
  /** Prefer native browser scrollbars over renderer-styled scrollbars. */ nativeScrollbars?: boolean;
  /** Render the operation path in the middle/content panel layout. */ pathInMiddlePanel?: boolean;
  /** Sort required schema properties before optional properties. */ requiredPropsFirst?: boolean;
  /** Sort schema properties alphabetically. */ sortPropsAlphabetically?: boolean;
  /** Show request headers in operation documentation. */ showRequestHeaders?: boolean;
  /** Disable automatic authentication value application in Try It. */ noAutoAuth?: boolean;
  /** Defer rendering of off-screen/heavy documentation content where supported. */ lazyRendering?: boolean;
  /** Scroll offset applied when navigating to anchored content. */ scrollYOffset?: number | string;
  /** Suppress renderer warning messages intended for authors. */ suppressWarnings?: boolean;
  /** Preferred zero-based payload sample index when multiple examples exist. */ payloadSampleIdx?: number;
  /** Runtime Intelligence endpoint metadata advertised by the backend host. */ runtimeIntelligence?: FlexDocRuntimeIntelligencePublicOptions;
  /** Try It and sibling API Client behavior. */ tryIt?: FlexDocTryItOptions;
  /** Generated code-sample configuration. */ codeSamples?: FlexDocCodeSampleOptions;
  /** Footer content rendered below documentation. */ footer?: FlexDocFooterOptions;
}
