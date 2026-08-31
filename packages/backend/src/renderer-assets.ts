import * as fs from 'fs';
import * as path from 'path';

export interface RendererAssets {
  javascript: string;
  css: string;
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

export function getRendererAssets(): RendererAssets {
  if (cachedAssets) return cachedAssets;

  cachedAssets = {
    javascript: fs.readFileSync(findAsset('flexdoc.standalone.js'), 'utf8'),
    css: fs.readFileSync(findAsset('flexdoc.standalone.css'), 'utf8'),
  };

  return cachedAssets;
}
