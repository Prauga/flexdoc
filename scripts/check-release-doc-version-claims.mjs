import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;
const cliVersion = json('tools/flexdoc-cli/package.json').version;
const releaseState = json('scripts/release-versions.json');
const { published, sourceReleaseDocument } = releaseState;
const release = read(sourceReleaseDocument);
const operations = read('docs/host-execution-operations.md');

const claims = [
  [sourceReleaseDocument, release, `\`@prauga/flexdoc-client\` — **${clientVersion}**`],
  [sourceReleaseDocument, release, `\`@prauga/flexdoc-backend\` — **${backendVersion}**`],
  ['docs/host-execution-operations.md', operations, `\`@prauga/flexdoc-backend\` **${backendVersion}**`],
];

for (const [path, content, claim] of claims) {
  if (!content.includes(claim)) {
    fail(`${path} is stale: expected version claim ${claim}`);
  }
}

/** Compare dotted numeric versions, tolerating a missing patch component. */
function compareVersions(a, b) {
  const parse = (value) => value.split('.').map(Number);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

// Phrases that assert a version has NOT been published yet. Deliberately narrow:
// "release candidate" alone also describes historical, already-shipped work.
const PENDING_PUBLICATION = /release[- ]prepared|not yet published|remains a repository command|\buntil\b.*\bpublished\b/i;
const PUBLISHED_LINE = /published coordinated product line is \*\*(\d+\.\d+(?:\.\d+)?)\*\*/;

const documents = [...markdownFiles('docs'), 'README.md'];
const staleClaims = [];

for (const file of documents) {
  read(file).split('\n').forEach((line, index) => {
    const location = `${file}:${index + 1}`;

    const published = line.match(PUBLISHED_LINE);
    if (published && compareVersions(published[1], releaseState.published.client) !== 0) {
      staleClaims.push(`${location}: claims the published product line is ${published[1]}, but the published baseline is ${releaseState.published.client}`);
    }

    const pending = line.match(PENDING_PUBLICATION);
    if (!pending) return;

    const shipped = new Set();
    for (const [, version] of line.matchAll(/\bcli\/v(\d+\.\d+\.\d+)\b/g)) {
      if (compareVersions(version, cliVersion) <= 0) shipped.add(`CLI ${version}`);
    }
    // Product-line versions only. Native adapters are independently versioned on
    // 0.x tracks and may legitimately be described as not yet published.
    for (const [, version] of line.matchAll(/\b([2-9]\d*\.\d+(?:\.\d+)?)\b/g)) {
      if (compareVersions(version, releaseState.published.client) <= 0) shipped.add(version);
    }

    // One finding per line: the phrase and the version are often separated by
    // unrelated prose, so point a human at the line rather than guessing which
    // version the phrase governs.
    if (shipped.size) {
      staleClaims.push(
        `${location}: says "${pending[0]}" on a line naming already-shipped ${[...shipped].join(', ')} (tree is client ${clientVersion} / CLI ${cliVersion})`,
      );
    }
  });
}

if (staleClaims.length) {
  console.error('Documentation names versions that this tree has already moved past:');
  for (const claim of staleClaims) console.error(`- ${claim}`);
  console.error('\nDocumentation must not steer users to a source checkout for a release that has shipped.');
  process.exit(1);
}

if (process.argv.includes('--registry')) {
  // Opt-in: the checks above are deterministic because they compare documentation
  // against in-tree package versions. This one reaches the network and can change
  // without any commit, so it belongs in release workflows rather than PR CI.
  const published = (name) => execFileSync('npm', ['view', name, 'version'], { encoding: 'utf8' }).trim();
  const behind = [
    ['@prauga/flexdoc-client', clientVersion],
    ['@prauga/flexdoc-cli', cliVersion],
  ].filter(([name, local]) => compareVersions(local, published(name)) < 0);

  if (behind.length) {
    console.error('This tree is behind the registry, so its documentation claims are stale:');
    for (const [name, local] of behind) console.error(`- ${name}: tree ${local}, registry ${published(name)}`);
    process.exit(1);
  }
}

console.log(
  `Release documentation version claims match source client ${clientVersion} / backend ${backendVersion}, published client ${releaseState.published.client}, and CLI ${cliVersion} across ${documents.length} documents.`,
);
