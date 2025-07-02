/**
 * Logo customization options
 */
export interface LogoOptions {
  /** URL or path to the logo image */
  url: string;
  /** Background color for the logo area (CSS color value) */
  backgroundColor?: string;
  /** Padding around the logo in pixels or CSS value (e.g., '10px' or '10px 20px') */
  padding?:
    | string
    | {
        vertical?: string | number;
        horizontal?: string | number;
      };
  /** Maximum height of the logo in pixels or CSS value */
  maxHeight?: string | number;
  /** Maximum width of the logo in pixels or CSS value */
  maxWidth?: string | number;
  /** Alt text for the logo image */
  alt?: string;
  /** CSS class to apply to the logo container */
  containerClass?: string;
  /** Whether to make the logo clickable to return to the documentation root */
  clickable?: boolean;
}

/**
 * Theme color configuration
 */
export interface ThemeColors {
  primary?: {
    main?: string;
    light?: string;
    dark?: string;
  };
  success?: {
    main?: string;
    light?: string;
    dark?: string;
  };
  error?: {
    main?: string;
    light?: string;
    dark?: string;
  };
  text?: {
    primary?: string;
    secondary?: string;
  };
  gray?: {
    50?: string;
    100?: string;
  };
  border?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Theme typography configuration
 */
export interface ThemeTypography {
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  headings?: {
    fontFamily?: string;
    fontWeight?: string;
  };
  code?: {
    fontSize?: string;
    fontFamily?: string;
    lineHeight?: string;
    color?: string;
    backgroundColor?: string;
    wrap?: boolean;
  };
}

/**
 * Theme sidebar configuration
 */
export interface ThemeSidebar {
  backgroundColor?: string;
  backgroundColorDark?: string;
  textColor?: string;
  textColorDark?: string;
  activeTextColor?: string;
  activeTextColorDark?: string;
  borderColor?: string;
  borderColorDark?: string;
  groupItems?: {
    textTransform?: string;
  };
}

/**
 * Advanced theme configuration
 */
/**
 * HTTP method badge color configuration
 */
export interface MethodColors {
  get?: {
    bg?: string;
    border?: string;
  };
  post?: {
    bg?: string;
    border?: string;
  };
  put?: {
    bg?: string;
    border?: string;
  };
  delete?: {
    bg?: string;
    border?: string;
  };
  patch?: {
    bg?: string;
    border?: string;
  };
  options?: {
    bg?: string;
    border?: string;
  };
  head?: {
    bg?: string;
    border?: string;
  };
}

export interface ThemeConfig {
  colors?: ThemeColors;
  typography?: ThemeTypography;
  sidebar?: ThemeSidebar;
  methodColors?: MethodColors;
}

export interface FlexDocOptions {
  title?: string;
  description?: string;
  version?: string;
  /**
   * Theme configuration - can be 'light', 'dark', or a detailed ThemeConfig object
   * @example 'light' | 'dark' | { colors: { primary: { main: '#0C4C91' } } }
   */
  theme?: 'light' | 'dark' | ThemeConfig;
  customCss?: string;
  customJs?: string;
  favicon?: string;
  /** Logo configuration - can be a simple URL string or a LogoOptions object for advanced customization */
  logo?: string | LogoOptions;
  hideDownloadButton?: boolean;
  hideTopbar?: boolean;
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
}

export interface FlexDocModuleOptions {
  path: string;
  specUrl?: string;
  spec?: object;
  options?: FlexDocOptions;
}

