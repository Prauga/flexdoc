/** Build/source identity embedded into the published FlexDoc renderer. */
export interface FlexDocBuildInfo {
  /** Published renderer package version. */ version: string;
  /** Source commit used to build the renderer. */ commit: string;
  /** Deterministic source/commit timestamp. */ sourceDate: string;
  /** Renderer-host compatibility contract version. */ contractVersion: '1';
  /** Canonical source repository. */ repository: string;
}

declare const __FLEXDOC_BUILD_INFO__: FlexDocBuildInfo;

/** Runtime-visible renderer build identity for diagnostics and support. */
export const FLEXDOC_BUILD_INFO: FlexDocBuildInfo = typeof __FLEXDOC_BUILD_INFO__ === 'undefined'
  ? { version: 'dev', commit: 'unknown', sourceDate: 'unknown', contractVersion: '1', repository: 'https://github.com/Prauga/flexdoc' }
  : __FLEXDOC_BUILD_INFO__;
