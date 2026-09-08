import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

/** Canonical renderer assets loaded by the Node backend package. */
export interface RendererAssets {
  /** Standalone renderer JavaScript source. */
  javascript: string;
  /** Standalone renderer stylesheet source. */
  css: string;
  /** Stable content fingerprint used to version immutable asset URLs. */
  version: string;
}

function findAsset(relativePath: string): string {
  const candidates = [
    path.join(__dirname, 'renderer', relativePath),
    path.resolve(__dirname, '../../client/dist/standalone', relativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `FlexDoc renderer asset not found: ${relativePath}. Build @prauga/flexdoc-client before @prauga/flexdoc-backend.`
  );
}

let cachedAssets: RendererAssets | null = null;

/**
 * Load and cache the version-matched canonical browser renderer assets.
 * @returns JavaScript/CSS source plus a stable SHA-256 content fingerprint.
 * @throws When the packaged/copied renderer assets cannot be found or read.
 */
export function getRendererAssets(): RendererAssets {
  if (cachedAssets) return cachedAssets;

  const javascript = fs.readFileSync(findAsset('flexdoc.standalone.js'), 'utf8');
  const css = fs.readFileSync(findAsset('flexdoc.standalone.css'), 'utf8');
  cachedAssets = {
    javascript,
    css,
    version: createHash('sha256').update(javascript).update('\0').update(css).digest('hex').slice(0, 16),
  };

  return cachedAssets;
}
