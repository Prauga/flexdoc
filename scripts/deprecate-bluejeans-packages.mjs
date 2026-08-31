import { spawnSync } from 'node:child_process';
import process from 'node:process';

const migrations = [
  ['@prauga/flexdoc-client', '@prauga/flexdoc-client'],
  ['@prauga/flexdoc-backend', '@prauga/flexdoc-backend'],
  ['@prauga/flexdoc-core', '@prauga/flexdoc-core'],
  ['@prauga/flexdoc-cli', '@prauga/flexdoc-cli'],
];
const apply = process.argv.includes('--apply');

function npm(args, options = {}) {
  return spawnSync('npm', args, { encoding: 'utf8', stdio: options.stdio ?? 'pipe' });
}

if (apply) {
  const whoami = npm(['whoami']);
  if (whoami.status !== 0) throw new Error('npm authentication is required before applying deprecations. Run npm login first.');
  console.log(`Authenticated to npm as ${whoami.stdout.trim()}.`);
}

for (const [oldName, newName] of migrations) {
  const oldPackage = npm(['view', oldName, 'name']);
  if (oldPackage.status !== 0) {
    console.log(`skip ${oldName}: package is not published`);
    continue;
  }
  const target = npm(['view', newName, 'name']);
  if (target.status !== 0) throw new Error(`Refusing to deprecate ${oldName}: replacement ${newName} is not published yet.`);
  const message = `This package has moved to ${newName}. Please migrate to the @prauga scope; ${oldName} is no longer maintained.`;
  if (!apply) {
    console.log(`dry-run: npm deprecate ${oldName}@* ${JSON.stringify(message)}`);
    continue;
  }
  const result = npm(['deprecate', `${oldName}@*`, message], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to deprecate ${oldName}.`);
}

if (!apply) console.log('No registry changes made. Re-run with --apply after the @prauga replacements are published and npm authentication is active.');
