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

export interface FlexDocOptions {
  title?: string;
  description?: string;
  version?: string;
  theme?: 'light' | 'dark';
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
  theme_?: {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      surface?: string;
      text?: string;
      textSecondary?: string;
      border?: string;
    };
    typography?: {
      fontSize?: string;
      fontFamily?: string;
      lineHeight?: string;
    };
    spacing?: {
      unit?: number;
    };
  };
}

export interface FlexDocModuleOptions {
  path: string;
  specUrl?: string;
  spec?: object;
  options?: FlexDocOptions;
}

