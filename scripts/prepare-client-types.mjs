import { cpSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const packageDir = resolve(process.cwd());
const rawDir = join(packageDir, 'dist/types');
const tempDir = join(packageDir, 'dist/.types-raw');
const esmDir = join(packageDir, 'dist/types/esm');
const cjsDir = join(packageDir, 'dist/types/cjs');

rmSync(tempDir, { recursive: true, force: true });
cpSync(rawDir, tempDir, { recursive: true });
rmSync(rawDir, { recursive: true, force: true });
mkdirSync(esmDir, { recursive: true });
mkdirSync(cjsDir, { recursive: true });
cpSync(tempDir, esmDir, { recursive: true });
cpSync(tempDir, cjsDir, { recursive: true });
rmSync(tempDir, { recursive: true, force: true });

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}

function addExtension(source, extension) {
  return source.replace(/(from\s+['"]|export\s+\*\s+from\s+['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (match, prefix, specifier, suffix) => {
    if (/\.(?:js|mjs|cjs|json)$/.test(specifier)) return match;
    return `${prefix}${specifier}${extension}${suffix}`;
  });
}

walk(esmDir, (path) => {
  if (!path.endsWith('.d.ts')) return;
  writeFileSync(path, addExtension(readFileSync(path, 'utf8'), '.js'));
});

const cjsFiles = [];
walk(cjsDir, (path) => {
  if (!path.endsWith('.d.ts')) return;
  writeFileSync(path, addExtension(readFileSync(path, 'utf8'), '.cjs'));
  cjsFiles.push(path);
});
for (const path of cjsFiles.sort((a, b) => b.length - a.length)) {
  renameSync(path, path.replace(/\.d\.ts$/, '.d.cts'));
}

const esmIndex = join(esmDir, 'index.d.ts');
const cjsIndex = join(cjsDir, 'index.d.cts');
if (!statSync(esmIndex).isFile() || !statSync(cjsIndex).isFile()) {
  throw new Error('Failed to prepare dual declaration entrypoints');
}

console.log(`Prepared client declarations: ${relative(packageDir, esmIndex)} and ${relative(packageDir, cjsIndex)}`);
