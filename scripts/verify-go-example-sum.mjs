import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adapterDir = resolve(repoRoot, 'adapters/go');
const gitText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const gitBytes = (path) => Buffer.from(gitText(path));
const adapterGoMod = gitText(resolve(adapterDir, 'go.mod'));
const exampleGoMod = gitText(resolve(repoRoot, 'examples/go-net-http/go.mod'));
const write = process.argv.includes('--write');

const moduleMatch = adapterGoMod.match(/^module\s+(\S+)$/m);
if (!moduleMatch) throw new Error('Could not read the Go adapter module path');
const modulePath = moduleMatch[1];

const requirementPattern = new RegExp(`^require\\s+${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(v\\S+)$`, 'm');
const requirementMatch = exampleGoMod.match(requirementPattern);
if (!requirementMatch) throw new Error(`Could not find an exact ${modulePath} requirement in the Go example`);
const version = requirementMatch[1];

const outputText = (value) => {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
};
const proxyMissPattern = /\b(?:404|410)\b|not found|unknown revision|invalid version|no matching versions|unrecognized import path/i;

const publishedChecksum = () => {
  const scratch = mkdtempSync(join(tmpdir(), 'flexdoc-go-checksum-'));
  try {
    writeFileSync(join(scratch, 'go.mod'), 'module flexdoc-checksum\n\ngo 1.25\n');
    const result = JSON.parse(execFileSync('go', ['mod', 'download', '-json', `${modulePath}@${version}`], {
      cwd: scratch,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    if (result.Error) {
      if (proxyMissPattern.test(result.Error)) return { kind: 'miss', detail: result.Error };
      throw new Error(`Go module proxy query failed for ${modulePath} ${version}: ${result.Error}`);
    }
    if (!result.Sum || !result.GoModSum) {
      throw new Error(`Go module proxy returned incomplete checksum metadata for ${modulePath} ${version}`);
    }
    return {
      kind: 'published',
      checksum: `${modulePath} ${version} ${result.Sum}\n${modulePath} ${version}/go.mod ${result.GoModSum}\n`,
    };
  } catch (error) {
    const stdout = outputText(error?.stdout);
    const stderr = outputText(error?.stderr).trim();
    let downloadError = '';
    try {
      downloadError = JSON.parse(stdout)?.Error || '';
    } catch {
      // Non-JSON command failures are handled using stderr below.
    }
    const detail = [downloadError, stderr].filter(Boolean).join('\n');
    if (proxyMissPattern.test(detail)) return { kind: 'miss', detail };
    if (error instanceof Error && error.message.startsWith('Go module proxy ')) throw error;
    throw new Error(
      `Could not query the Go module proxy for ${modulePath} ${version}${detail ? `:\n${detail}` : ''}`,
      { cause: error },
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

const sha256Hex = (content) => createHash('sha256').update(content).digest('hex');
const hash1 = (entries) => {
  const summary = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => `${sha256Hex(content)}  ${name}\n`)
    .join('');
  return `h1:${createHash('sha256').update(summary).digest('base64')}`;
};

const sourceChecksum = () => {
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
    return [`${modulePrefix}/${moduleRelativePath}`, gitBytes(absolutePath)];
  });

  // Go's VCS module-zip creation copies the repository-root LICENSE into a
  // submodule zip when the submodule does not contain its own LICENSE.
  if (!trackedAdapterFiles.some((path) => path === 'adapters/go/LICENSE')) {
    moduleEntries.push([`${modulePrefix}/LICENSE`, gitBytes(resolve(repoRoot, 'LICENSE'))]);
  }

  const moduleHash = hash1(moduleEntries);
  const goModHash = hash1([['go.mod', Buffer.from(adapterGoMod)]]);
  return `${modulePath} ${version} ${moduleHash}\n${modulePath} ${version}/go.mod ${goModHash}\n`;
};

// Once a version exists on the public Go module infrastructure, its checksum
// is authoritative. Only an explicit proxy miss means the tag is treated as a
// future release and validated against the deterministic tracked source tree.
// Other proxy/query failures are errors rather than silently using source data.
const proxy = publishedChecksum();
const expected = proxy.kind === 'published' ? proxy.checksum : sourceChecksum();
const sumPath = resolve(repoRoot, 'examples/go-net-http/go.sum');
let actual = '';
try {
  actual = gitText(sumPath);
} catch {
  // The messages below contain the exact file content needed for the release tree.
}

if (actual !== expected && write) {
  writeFileSync(sumPath, expected);
  const source = proxy.kind === 'published' ? 'published Go proxy checksum' : 'deterministic future-release checksum after a Go proxy miss';
  console.log(`Updated ${relative(repoRoot, sumPath)} for ${modulePath} ${version} using the ${source}.`);
  process.exit(0);
}

if (actual !== expected) {
  if (proxy.kind === 'published') {
    console.error(`Go example checksum pin is stale for published ${modulePath} ${version}. The Go module proxy reports:\n`);
  } else {
    console.error(`Go proxy miss for ${modulePath} ${version}; the tag is not published yet.`);
    console.error('Future-release Go example checksum pin is missing or stale. Expected examples/go-net-http/go.sum to contain:\n');
  }
  console.error(expected);
  process.exit(1);
}

if (proxy.kind === 'published') {
  console.log(`Verified published ${modulePath} ${version} checksum pin against the Go module proxy.`);
} else {
  console.log(`Go proxy miss for ${modulePath} ${version}; verified deterministic future-release checksum pin.`);
}
