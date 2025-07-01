export interface FlexDocOptions {
  title?: string;
  description?: string;
  version?: string;
  theme?: 'light' | 'dark';
  customCss?: string;
  customJs?: string;
  favicon?: string;
  logo?: string;
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