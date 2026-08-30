import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const packageDir = resolve(repoRoot, 'packages/client');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const tempRoot = mkdtempSync(join(tmpdir(), 'flexdoc-client-package-'));
const packDir = join(tempRoot, 'pack');
mkdirSync(packDir);

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: options.cwd ?? repoRoot, encoding: 'utf8', stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', ...options });
}
function collectExportPaths(value, paths = []) {
  if (typeof value === 'string') { if (value.startsWith('./')) paths.push(value); return paths; }
  if (value && typeof value === 'object') for (const child of Object.values(value)) collectExportPaths(child, paths);
  return paths;
}
function smoke(name, type, sourceName, compilerOptions, tarball) {
  const dir = join(tempRoot, name); mkdirSync(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `flexdoc-${name}`, private: true, type }, null, 2));
  run('npm', ['install','--ignore-scripts','--no-audit','--no-fund','--package-lock=false',tarball,'react@19','react-dom@19','@types/react@19','@types/react-dom@19','typescript@5'], { cwd: dir });
  writeFileSync(join(dir, sourceName), `import { FlexDoc, sampleSpec, OpenAPIParser, buildRequest } from '@bluejeans/flexdoc-client';\nimport type { FlexDocProps, OpenAPISpec } from '@bluejeans/flexdoc-client';\nconst component: typeof FlexDoc = FlexDoc;\nconst spec: OpenAPISpec = sampleSpec;\nconst parser = OpenAPIParser;\nconst requestBuilder = buildRequest;\nconst props: FlexDocProps = { spec };\nvoid [component, parser, requestBuilder, props];\n`);
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target:'ES2020', jsx:'react-jsx', strict:true, skipLibCheck:false, noEmit:true, ...compilerOptions }, include:[sourceName] }, null, 2));
  run('npm', ['exec','--','tsc','-p','tsconfig.json'], { cwd: dir });
}

try {
  const [packed] = JSON.parse(run('npm', ['pack','-w','packages/client','--pack-destination',packDir,'--json'], { capture:true }));
  if (!packed?.filename) throw new Error('npm pack did not report a tarball filename');
  const tarball = join(packDir, packed.filename);
  const entries = new Set(run('tar', ['-tzf',tarball], { capture:true }).split(/\r?\n/).filter(Boolean).map(e => e.replace(/^package\//,'').replace(/\/$/,'')));
  const declared = [manifest.main,manifest.module,manifest.types,manifest.style].filter(Boolean).concat(collectExportPaths(manifest.exports));
  const missing = [...new Set(declared)].map(e => e.replace(/^\.\//,'')).filter(e => !entries.has(e));
  if (missing.length) throw new Error(`Published package metadata points to missing files:\n${missing.join('\n')}`);
  for (const required of ['dist/types/esm/index.d.ts','dist/types/cjs/index.d.cts']) if (!entries.has(required)) throw new Error(`Missing declaration entry: ${required}`);
  const unwanted = [...entries].filter(e => e.startsWith('dist/types/') && (e.includes('.test.d.') || e.includes('/setupTests.d.')));
  if (unwanted.length) throw new Error(`Test declarations leaked into package:\n${unwanted.join('\n')}`);

  smoke('bundler-esm','module','consumer.ts',{ module:'ESNext', moduleResolution:'Bundler' },tarball);
  smoke('nodenext-esm','module','consumer.mts',{ module:'NodeNext', moduleResolution:'NodeNext' },tarball);
  smoke('nodenext-cjs','commonjs','consumer.cts',{ module:'NodeNext', moduleResolution:'NodeNext' },tarball);
  console.log(`Verified packed ${manifest.name}@${manifest.version} in Bundler ESM, NodeNext ESM, and NodeNext CommonJS consumers.`);
} finally { rmSync(tempRoot, { recursive:true, force:true }); }
