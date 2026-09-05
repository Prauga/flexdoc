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

export type ExpandSection = 'parameters' | 'requestBody' | 'responses' | 'tryIt' | 'codeSamples';
export type ExpandPreset = 'all' | 'none' | 'minimal' | 'documentation' | 'interactive';
export type ExpandOption = ExpandPreset | Array<ExpandSection | Exclude<ExpandPreset, 'all' | 'none'>>;

export interface FlexDocRendererOptions {
  contractVersion?: '1';
  title?: string;
  description?: string;
  altDescription?: string;
  version?: string;
  tagGroups?: Array<{ name: string; tags: string[] }>;
  theme?: 'light' | 'dark' | ThemeConfig;
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
  tryIt?: {
    enabled?: boolean;
    defaultServer?: string;
    credentials?: RequestCredentials;
    requestInterceptor?: (request: RequestInit & { url: string }) => Promise<RequestInit & { url: string }> | (RequestInit & { url: string });
    apiClientPersistenceKey?: string | false;
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
