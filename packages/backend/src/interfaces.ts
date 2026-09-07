/** Logo customization options */
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

export interface ThemeColors {
  primary?: { main?: string; light?: string; dark?: string };
  success?: { main?: string; light?: string; dark?: string };
  error?: { main?: string; light?: string; dark?: string };
  text?: { primary?: string; secondary?: string };
  gray?: { 50?: string; 100?: string };
  border?: { dark?: string; light?: string };
}
export interface ThemeTypography {
  fontSize?: string; lineHeight?: string; fontFamily?: string;
  headings?: { fontFamily?: string; fontWeight?: string };
  code?: { fontSize?: string; fontFamily?: string; lineHeight?: string; color?: string; backgroundColor?: string; wrap?: boolean };
}
export interface ThemeSidebar {
  backgroundColor?: string; backgroundColorDark?: string; textColor?: string; textColorDark?: string;
  activeTextColor?: string; activeTextColorDark?: string; borderColor?: string; borderColorDark?: string;
  groupItems?: { textTransform?: string };
}
export interface MethodColors {
  get?: { bg?: string; border?: string }; post?: { bg?: string; border?: string }; put?: { bg?: string; border?: string };
  delete?: { bg?: string; border?: string }; patch?: { bg?: string; border?: string }; options?: { bg?: string; border?: string };
  head?: { bg?: string; border?: string };
}
export interface ThemeConfig { colors?: ThemeColors; typography?: ThemeTypography; sidebar?: ThemeSidebar; methodColors?: MethodColors; }

export type ExpandSection = 'parameters' | 'requestBody' | 'responses' | 'tryIt' | 'codeSamples';
export type ExpandPreset = 'all' | 'none' | 'minimal' | 'documentation' | 'interactive';
export type ExpandOption = ExpandPreset | Array<ExpandSection | Exclude<ExpandPreset, 'all' | 'none'>>;

export type FlexDocHostExecutionCapability = 'cookies' | 'clientCertificates' | 'digest' | 'hawk' | 'ntlm' | 'oauth1' | 'awsv4';
export interface FlexDocHostExecutionCertificate {
  id: string;
  name: string;
  cert: string;
  key: string;
  passphrase?: string;
}
export interface FlexDocHostExecutionRequest {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: Buffer;
}
export interface FlexDocHostExecutionOptions {
  enabled?: boolean;
  allowedOrigins?: string[];
  clientCertificates?: FlexDocHostExecutionCertificate[];
  interceptor?: (request: FlexDocHostExecutionRequest) => FlexDocHostExecutionRequest | Promise<FlexDocHostExecutionRequest>;
}
export interface FlexDocHostExecutionPublicOptions {
  available: boolean;
  endpoint: string;
  capabilities: FlexDocHostExecutionCapability[];
  clientCertificates?: Array<{ id: string; name: string }>;
  cookiesEndpoint?: string;
}

export interface FlexDocRuntimeIntelligenceOptions { enabled: true; }
export interface FlexDocRuntimeIntelligencePublicOptions {
  available: boolean;
  endpoint: string;
  framework: string;
}

export interface FlexDocOptions {
  contractVersion?: '1';
  title?: string; description?: string; altDescription?: string; version?: string;
  tagGroups?: { name: string; tags: string[] }[];
  theme?: 'light' | 'dark' | ThemeConfig;
  customCss?: string; customJs?: string; favicon?: string; logo?: string | LogoOptions;
  hideDownloadButton?: boolean; hideTopbar?: boolean; expand?: ExpandOption; expandResponses?: string; defaultModelsExpandDepth?: number;
  showExtensions?: boolean; showCommonExtensions?: boolean; hideHostname?: boolean; hideLoading?: boolean; nativeScrollbars?: boolean;
  pathInMiddlePanel?: boolean; requiredPropsFirst?: boolean; sortPropsAlphabetically?: boolean; showRequestHeaders?: boolean;
  noAutoAuth?: boolean; lazyRendering?: boolean; scrollYOffset?: number | string; suppressWarnings?: boolean; payloadSampleIdx?: number;
  /** Protect the documentation route itself. This is server-only and is never exposed to the renderer. */
  auth?: { type: 'basic' | 'bearer'; secretKey: string };
  /** Explicit opt-in to expose backend runtime route topology and presence drift under the docs auth boundary. */
  runtimeIntelligence?: boolean | FlexDocRuntimeIntelligenceOptions;
  tryIt?: {
    enabled?: boolean;
    defaultServer?: string;
    credentials?: 'omit' | 'same-origin' | 'include';
    apiClientPersistenceKey?: string | false;
    /** Explicit opt-in for API-host execution. Server-only; secrets are never serialized. */
    hostExecution?: boolean | FlexDocHostExecutionOptions;
  };
  codeSamples?: { enabled?: boolean; languages?: Array<'curl' | 'javascript' | 'python' | 'go' | 'java'> };
  footer?: { copyright?: string; link?: Array<{ text: string; url: string; icon?: string }> };
}

export interface FlexDocModuleOptions { path: string; specUrl?: string; spec?: object; options?: FlexDocOptions; }
