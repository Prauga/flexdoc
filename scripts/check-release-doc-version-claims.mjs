import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;
const release = read('docs/releases/3.3.md');
const operations = read('docs/host-execution-operations.md');

const claims = [
  ['docs/releases/3.3.md', release, `\`@prauga/flexdoc-client\` — **${clientVersion}**`],
  ['docs/releases/3.3.md', release, `\`@prauga/flexdoc-backend\` — **${backendVersion}**`],
  ['docs/host-execution-operations.md', operations, `\`@prauga/flexdoc-backend\` **${backendVersion}**`],
];

for (const [path, content, claim] of claims) {
  if (!content.includes(claim)) {
    fail(`${path} is stale: expected version claim ${claim}`);
  }
}

console.log(`Release documentation version claims match client ${clientVersion} / backend ${backendVersion}.`);
