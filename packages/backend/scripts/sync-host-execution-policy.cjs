const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../../core/src/host-execution-policy.ts');
const targetPath = path.resolve(__dirname, '../src/shared/host-execution-policy.ts');
const header = '// GENERATED from core/src/host-execution-policy.ts. Do not edit directly.\n';
const expected = header + fs.readFileSync(sourcePath, 'utf8');
const check = process.argv.includes('--check');

if (check) {
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  if (current !== expected) {
    console.error('Backend host-execution policy mirror is stale. Run npm run sync:host-execution-policy -w packages/backend.');
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, expected);
