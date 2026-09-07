/** Logo customization options passed from backend hosts to the canonical renderer. */
export interface LogoOptions {
  /** Image URL loaded for the documentation logo. */ url: string;
  /** Background color applied to the logo container. */ backgroundColor?: string;
  /** CSS padding for the logo container, or separate vertical/horizontal values. */ padding?: string | { vertical?: string | number; horizontal?: string | number };
  /** Maximum rendered logo height. Numeric values are interpreted as pixels. */ maxHeight?: string | number;
  /** Maximum rendered logo width. Numeric values are interpreted as pixels. */ maxWidth?: string | number;
  /** Alternative text used by the logo image. */ alt?: string;
  /** Additional CSS class applied to the logo container. */ containerClass?: string;
  /** Whether the logo behaves as a navigation control when a destination is available. */ clickable?: boolean;
}

/** Renderer color-token overrides accepted by backend integrations. */
export interface ThemeColors {
  /** Primary brand/accent color variants. */ primary?: { main?: string; light?: string; dark?: string };
  /** Success-state color variants. */ success?: { main?: string; light?: string; dark?: string };
  /** Error-state color variants. */ error?: { main?: string; light?: string; dark?: string };
  /** Primary and secondary text colors. */ text?: { primary?: string; secondary?: string };
  /** Neutral gray tokens used by light renderer surfaces. */ gray?: { 50?: string; 100?: string };
  /** Border colors for dark and light themes. */ border?: { dark?: string; light?: string };
}

/** Renderer typography-token overrides accepted by backend integrations. */
export interface ThemeTypography {
  /** Base renderer font size. */ fontSize?: string;
  /** Base renderer line height. */ lineHeight?: string;
  /** Base renderer font family. */ fontFamily?: string;
  /** Heading-specific font overrides. */ headings?: { fontFamily?: string; fontWeight?: string };
  /** Code block/editor typography and wrapping overrides. */ code?: { fontSize?: string; fontFamily?: string; lineHeight?: string; color?: string; backgroundColor?: string; wrap?: boolean };
}

/** Renderer sidebar-token overrides accepted by backend integrations. */
export interface ThemeSidebar {
  /** Sidebar background in light mode. */ backgroundColor?: string;
  /** Sidebar background in dark mode. */ backgroundColorDark?: string;
  /** Sidebar text color in light mode. */ textColor?: string;
  /** Sidebar text color in dark mode. */ textColorDark?: string;
  /** Active sidebar text color in light mode. */ activeTextColor?: string;
  /** Active sidebar text color in dark mode. */ activeTextColorDark?: string;
  /** Sidebar border color in light mode. */ borderColor?: string;
  /** Sidebar border color in dark mode. */ borderColorDark?: string;
  /** Styling applied to grouped navigation labels. */ groupItems?: { textTransform?: string };
}

/** HTTP method badge color overrides. */
export interface MethodColors {
  /** GET badge colors. */ get?: { bg?: string; border?: string };
  /** POST badge colors. */ post?: { bg?: string; border?: string };
  /** PUT badge colors. */ put?: { bg?: string; border?: string };
  /** DELETE badge colors. */ delete?: { bg?: string; border?: string };
  /** PATCH badge colors. */ patch?: { bg?: string; border?: string };
  /** OPTIONS badge colors. */ options?: { bg?: string; border?: string };
  /** HEAD badge colors. */ head?: { bg?: string; border?: string };
}

/** Custom renderer theme tokens serialized by backend hosts. */
export interface ThemeConfig {
  /** Color-token overrides. */ colors?: ThemeColors;
  /** Typography-token overrides. */ typography?: ThemeTypography;
  /** Sidebar-token overrides. */ sidebar?: ThemeSidebar;
  /** Per-method badge colors. */ methodColors?: MethodColors;
}

/** Section identifiers used by expand presets and custom expand arrays. */
export type ExpandSection = 'parameters' | 'requestBody' | 'responses' | 'tryIt' | 'codeSamples';
/** Built-in expand presets for operation detail panels. */
export type ExpandPreset = 'all' | 'none' | 'minimal' | 'documentation' | 'interactive';
/** Expand preset or explicit list of sections/presets to open by default. */
export type ExpandOption = ExpandPreset | Array<ExpandSection | Exclude<ExpandPreset, 'all' | 'none'>>;

/** API-host execution capabilities implemented by a backend host. */
export type FlexDocHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';

/** Server-side client-certificate material available to API-host execution. */
export interface FlexDocHostExecutionCertificate {
  /** Stable identifier exposed safely to the renderer for selection. */ id: string;
  /** Human-readable certificate name exposed to the renderer. */ name: string;
  /** PEM-encoded client certificate retained only on the backend. */ cert: string;
  /** PEM-encoded private key retained only on the backend. */ key: string;
  /** Optional passphrase for the private key. */ passphrase?: string;
}

/** Normalized outbound request supplied to a host-execution interceptor. */
export interface FlexDocHostExecutionRequest {
  /** Uppercase HTTP method. */ method: string;
  /** Absolute target URL. */ url: string;
  /** Ordered request headers, preserving duplicate names. */ headers: Array<[string, string]>;
  /** Raw request body bytes when a body is present. */ body?: Buffer;
}

/** Server-only API-host execution configuration. */
export interface FlexDocHostExecutionOptions {
  /** Enable API-host execution routes. Defaults to disabled unless explicitly opted in. */ enabled?: boolean;
  /** Target origins the host is allowed to call; omitted values use the host's safe default policy. */ allowedOrigins?: string[];
  /** Client certificates that may be selected by id for outbound requests. */ clientCertificates?: FlexDocHostExecutionCertificate[];
  /** Hook invoked before the backend sends an outbound request. */ interceptor?: (request: FlexDocHostExecutionRequest) => FlexDocHostExecutionRequest | Promise<FlexDocHostExecutionRequest>;
}

/** Public host-execution metadata serialized to the browser renderer. */
export interface FlexDocHostExecutionPublicOptions {
  /** Whether the host-execution endpoint is currently available. */ available: boolean;
  /** Same-origin endpoint accepting execution requests. */ endpoint: string;
  /** Capabilities implemented by the backend host. */ capabilities: FlexDocHostExecutionCapability[];
  /** Safe certificate ids/names; certificate and key material are never serialized. */ clientCertificates?: Array<{ id: string; name: string }>;
  /** Same-origin endpoint used to inspect or clear the host-side cookie jar. */ cookiesEndpoint?: string;
}

/** Explicit Runtime Intelligence opt-in configuration. */
export interface FlexDocRuntimeIntelligenceOptions {
  /** Enable runtime route discovery and drift metadata for this documentation mount. */ enabled: true;
}

/** Runtime Intelligence endpoint metadata safe to serialize to the renderer. */
export interface FlexDocRuntimeIntelligencePublicOptions {
  /** Whether the runtime snapshot endpoint is available. */ available: boolean;
  /** Same-origin endpoint returning a runtime snapshot. */ endpoint: string;
  /** Backend framework identifier expected in snapshots. */ framework: string;
}

/** Renderer and Try It options passed to backend integrations. */
export interface FlexDocOptions {
  /** Renderer-host contract version. FlexDoc 3.x currently uses contract `1`. */ contractVersion?: '1';
  /** Title overriding `spec.info.title` in renderer chrome. */ title?: string;
  /** Primary API description overriding the OpenAPI description when supplied. */ description?: string;
  /** Alternate/secondary description supported by renderer hosts. */ altDescription?: string;
  /** Version text overriding the OpenAPI API version in renderer chrome. */ version?: string;
  /** Explicit navigation tag groups and their ordered tag names. */ tagGroups?: { name: string; tags: string[] }[];
  /** Light/dark preset or custom renderer theme tokens. */ theme?: 'light' | 'dark' | ThemeConfig;
  /** Raw CSS appended to renderer styling. */ customCss?: string;
  /** Raw JavaScript executed by the standalone renderer host. */ customJs?: string;
  /** Favicon URL used by the generated documentation page. */ favicon?: string;
  /** Logo URL or structured logo customization. */ logo?: string | LogoOptions;
  /** Hide the OpenAPI/download action from renderer chrome. */ hideDownloadButton?: boolean;
  /** Hide the renderer top bar. */ hideTopbar?: boolean;
  /** Default endpoint sections to expand. Viewer preferences can override this host default. */ expand?: ExpandOption;
  /** @deprecated Use `expand` instead. */ expandResponses?: string;
  /** Legacy model/schema expansion depth used by compatible renderer views. */ defaultModelsExpandDepth?: number;
  /** Show OpenAPI specification extensions in documentation views. */ showExtensions?: boolean;
  /** Show commonly recognized extension fields. */ showCommonExtensions?: boolean;
  /** Hide the hostname/server portion of request URLs in applicable UI. */ hideHostname?: boolean;
  /** Suppress the renderer loading indicator. */ hideLoading?: boolean;
  /** Prefer native browser scrollbars over renderer-styled scrollbars. */ nativeScrollbars?: boolean;
  /** Render operation paths in the middle/content panel layout. */ pathInMiddlePanel?: boolean;
  /** Sort required schema properties before optional properties. */ requiredPropsFirst?: boolean;
  /** Sort schema properties alphabetically. */ sortPropsAlphabetically?: boolean;
  /** Show request headers in operation documentation. */ showRequestHeaders?: boolean;
  /** Disable automatic authentication value application in Try It. */ noAutoAuth?: boolean;
  /** Defer rendering of off-screen/heavy documentation content where supported. */ lazyRendering?: boolean;
  /** Scroll offset applied when navigating to anchored content. */ scrollYOffset?: number | string;
  /** Suppress renderer warning messages intended for authors. */ suppressWarnings?: boolean;
  /** Preferred zero-based payload sample index when multiple examples exist. */ payloadSampleIdx?: number;
  /** Protect the documentation route itself. This is server-only and is never exposed to the renderer. */
  auth?: {
    /** Authentication mode enforced on FlexDoc documentation/runtime/host routes. */ type: 'basic' | 'bearer';
    /** Server-only secret used to validate or derive documentation credentials. */ secretKey: string;
  };
  /** Explicit opt-in to expose backend runtime route topology and presence drift under the docs auth boundary. */
  runtimeIntelligence?: boolean | FlexDocRuntimeIntelligenceOptions;
  /** Try It and sibling API Client behavior. */
  tryIt?: {
    /** Enable operation-level Try It controls. */ enabled?: boolean;
    /** Default server URL selected for requests. */ defaultServer?: string;
    /** Browser Fetch credentials mode used for direct requests. */ credentials?: 'omit' | 'same-origin' | 'include';
    /** IndexedDB workspace key used by API Client, or `false` to disable persistence. */ apiClientPersistenceKey?: string | false;
    /** Explicit opt-in for API-host execution. Server-only; secrets are never serialized. */ hostExecution?: boolean | FlexDocHostExecutionOptions;
  };
  /** Generated code-sample configuration. */
  codeSamples?: {
    /** Enable generated request code samples. */ enabled?: boolean;
    /** Ordered languages shown in code-sample tabs. */ languages?: Array<'curl' | 'javascript' | 'python' | 'go' | 'java'>;
  };
  /** Footer content rendered below documentation. */
  footer?: {
    /** Copyright/legal text shown in the footer. */ copyright?: string;
    /** Footer links with optional icon identifiers. */ link?: Array<{ text: string; url: string; icon?: string }>;
  };
}

/** Mount options for FlexDoc backend integrations. */
export interface FlexDocModuleOptions {
  /** URL path where the documentation host is mounted. */ path: string;
  /** Remote/served OpenAPI URL loaded when no inline `spec` is supplied. */ specUrl?: string;
  /** Inline parsed OpenAPI document. */ spec?: object;
  /** Renderer, auth, Runtime Intelligence, and Try It configuration. */ options?: FlexDocOptions;
}
