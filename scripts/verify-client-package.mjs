import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const packageDir = resolve(repoRoot, 'packages/client');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const tempRoot = mkdtempSync(join(tmpdir(), 'flexdoc-client-package-'));
const packDir = join(tempRoot, 'pack');
const consumerDir = join(tempRoot, 'consumer');
mkdirSync(packDir);
mkdirSync(consumerDir);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    ...options,
  });
}

function collectExportPaths(value, paths = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./')) paths.push(value);
    return paths;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectExportPaths(child, paths);
  }
  return paths;
}

try {
  const packOutput = run(
    'npm',
    ['pack', '-w', 'packages/client', '--pack-destination', packDir, '--json'],
    { capture: true },
  );
  const [packed] = JSON.parse(packOutput);
  if (!packed?.filename) throw new Error('npm pack did not report a tarball filename');

  const tarball = join(packDir, packed.filename);
  const entries = new Set(
    run('tar', ['-tzf', tarball], { capture: true })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((entry) => entry.replace(/^package\//, '').replace(/\/$/, '')),
  );

  const declaredPaths = [manifest.main, manifest.module, manifest.types, manifest.style]
    .filter(Boolean)
    .concat(collectExportPaths(manifest.exports));

  const missing = [...new Set(declaredPaths)]
    .map((entry) => entry.replace(/^\.\//, ''))
    .filter((entry) => !entries.has(entry));

  if (missing.length) {
    throw new Error(`Published package metadata points to missing files:\n${missing.join('\n')}`);
  }

  const declarationEntry = String(manifest.types ?? '').replace(/^\.\//, '');
  if (!declarationEntry || !entries.has(declarationEntry)) {
    throw new Error(`Type declaration entry is missing from tarball: ${manifest.types}`);
  }

  const unwantedDeclarations = [...entries].filter(
    (entry) =>
      entry.startsWith('dist/types/') &&
      (entry.endsWith('.test.d.ts') || entry.endsWith('/setupTests.d.ts') || entry === 'dist/types/setupTests.d.ts'),
  );
  if (unwantedDeclarations.length) {
    throw new Error(`Test declarations leaked into package:\n${unwantedDeclarations.join('\n')}`);
  }

  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'flexdoc-package-smoke-test', private: true, type: 'module' }, null, 2),
  );

  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarball,
      'react@19',
      'react-dom@19',
      'typescript@5',
    ],
    { cwd: consumerDir },
  );

  writeFileSync(
    join(consumerDir, 'consumer.ts'),
    `import { FlexDoc, sampleSpec, OpenAPIParser, buildRequest } from '@bluejeans/flexdoc-client';\n` +
      `import type { FlexDocProps, OpenAPISpec } from '@bluejeans/flexdoc-client';\n\n` +
      `const component: typeof FlexDoc = FlexDoc;\n` +
      `const spec: OpenAPISpec = sampleSpec;\n` +
      `const parser = OpenAPIParser;\n` +
      `const requestBuilder = buildRequest;\n` +
      `const props: FlexDocProps = { spec };\n` +
      `void [component, parser, requestBuilder, props];\n`,
  );

  writeFileSync(
    join(consumerDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    ),
  );

  run('npm', ['exec', '--', 'tsc', '-p', 'tsconfig.json'], { cwd: consumerDir });
  console.log(`Verified packed ${manifest.name}@${manifest.version} from a clean TypeScript consumer.`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
