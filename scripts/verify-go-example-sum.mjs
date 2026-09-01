import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adapterDir = resolve(repoRoot, 'adapters/go');
const adapterGoMod = readFileSync(resolve(adapterDir, 'go.mod'), 'utf8');
const exampleGoMod = readFileSync(resolve(repoRoot, 'examples/go-net-http/go.mod'), 'utf8');

const moduleMatch = adapterGoMod.match(/^module\s+(\S+)$/m);
if (!moduleMatch) throw new Error('Could not read the Go adapter module path');
const modulePath = moduleMatch[1];

const requirementPattern = new RegExp(`^require\\s+${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(v\\S+)$`, 'm');
const requirementMatch = exampleGoMod.match(requirementPattern);
if (!requirementMatch) throw new Error(`Could not find an exact ${modulePath} requirement in the Go example`);
const version = requirementMatch[1];

const sha256Hex = (content) => createHash('sha256').update(content).digest('hex');
const hash1 = (entries) => {
  const summary = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => `${sha256Hex(content)}  ${name}\n`)
    .join('');
  return `h1:${createHash('sha256').update(summary).digest('base64')}`;
};

const trackedAdapterFiles = execFileSync('git', ['ls-files', '--', 'adapters/go'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

const modulePrefix = `${modulePath}@${version}`;
const moduleEntries = trackedAdapterFiles.map((repoPath) => {
  const absolutePath = resolve(repoRoot, repoPath);
  const moduleRelativePath = relative(adapterDir, absolutePath).split(sep).join('/');
  return [`${modulePrefix}/${moduleRelativePath}`, readFileSync(absolutePath)];
});

// Go's VCS module-zip creation copies the repository-root LICENSE into a
// submodule zip when the submodule does not contain its own LICENSE.
if (!trackedAdapterFiles.some((path) => path === 'adapters/go/LICENSE')) {
  moduleEntries.push([`${modulePrefix}/LICENSE`, readFileSync(resolve(repoRoot, 'LICENSE'))]);
}

const moduleHash = hash1(moduleEntries);
const goModHash = hash1([['go.mod', Buffer.from(adapterGoMod)]]);
const expected = `${modulePath} ${version} ${moduleHash}\n${modulePath} ${version}/go.mod ${goModHash}\n`;
const sumPath = resolve(repoRoot, 'examples/go-net-http/go.sum');
let actual = '';
try {
  actual = readFileSync(sumPath, 'utf8');
} catch {
  // The message below contains the exact file content needed for the release tree.
}

if (actual !== expected) {
  console.error('Go example checksum pin is missing or stale. Expected examples/go-net-http/go.sum to contain:\n');
  console.error(expected);
  process.exit(1);
}

console.log(`Verified ${modulePath} ${version} checksum pin.`);
