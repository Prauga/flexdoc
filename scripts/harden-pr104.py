from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))

# Backend-local generated mirror. The backend package is CommonJS while core is
# ESM-only, so the canonical TypeScript source is mirrored at build/test time.
script = Path('packages/backend/scripts/sync-host-execution-policy.cjs')
script.parent.mkdir(parents=True, exist_ok=True)
script.write_text(r'''const fs = require('fs');
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
''')

# Generate the committed mirror from the canonical core source.
source = Path('core/src/host-execution-policy.ts').read_text()
target = Path('packages/backend/src/shared/host-execution-policy.ts')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text('// GENERATED from core/src/host-execution-policy.ts. Do not edit directly.\n' + source)

# Add drift checks to backend build/test without adding a runtime dependency on
# unpublished ESM-only @prauga/flexdoc-core.
pkg_path = Path('packages/backend/package.json')
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
scripts['sync:host-execution-policy'] = 'node scripts/sync-host-execution-policy.cjs'
scripts['check:host-execution-policy'] = 'node scripts/sync-host-execution-policy.cjs --check'
scripts['prebuild'] = 'npm run check:host-execution-policy'
scripts['pretest'] = 'npm run check:host-execution-policy'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# Wire Node enforcement to the shared contract.
replace_once(
    'packages/backend/src/host-execution.ts',
    "import { getPublicSuffix } from 'tldts';\n",
    "import { getPublicSuffix } from 'tldts';\nimport { createHostExecutionTargetPolicy, isHostExecutionOriginAllowed, normalizeHostExecutionOrigin } from './shared/host-execution-policy';\n",
)

replace_once(
    'packages/backend/src/host-execution.ts',
    """function normalizedOrigin(value: string, base?: string): string | undefined {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch { return undefined; }
}
""",
    """function resolvedHostExecutionOrigin(value: string, base?: string): string | undefined {
  try {
    const absolute = base ? new URL(value, base).toString() : value;
    return normalizeHostExecutionOrigin(absolute);
  } catch { return undefined; }
}
""",
)

replace_once(
    'packages/backend/src/host-execution.ts',
    """export function allowedHostExecutionOrigins(state: HostExecutionState, spec: any, docsOrigin?: string): Set<string> {
  const configured = state.options.allowedOrigins?.filter(Boolean);
  const result = new Set<string>();
  if (configured?.length) {
    for (const value of configured) {
      const origin = normalizedOrigin(value);
      if (origin) result.add(origin);
    }
    return result;
  }

  const servers = collectOpenApiServerUrls(spec);
  const values = servers.length ? servers : ['/'];
  for (const value of values) {
    const origin = normalizedOrigin(value, docsOrigin);
    if (origin) result.add(origin);
  }
  return result;
}
""",
    """export function allowedHostExecutionOrigins(state: HostExecutionState, spec: any, docsOrigin?: string): Set<string> {
  const configured = state.options.allowedOrigins?.filter(Boolean);
  if (configured?.length) {
    return new Set(createHostExecutionTargetPolicy({ allowedOrigins: configured }).allowedOrigins);
  }

  const servers = collectOpenApiServerUrls(spec);
  const values = servers.length ? servers : ['/'];
  const resolved = values.flatMap((value) => {
    const origin = resolvedHostExecutionOrigin(value, docsOrigin);
    return origin ? [origin] : [];
  });
  return new Set(createHostExecutionTargetPolicy({ allowedOrigins: resolved }).allowedOrigins);
}
""",
)

replace_once(
    'packages/backend/src/host-execution.ts',
    """export function assertHostExecutionUrlAllowed(url: URL, allowedOrigins: Set<string>): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HostExecutionForbiddenError(`Host execution only allows HTTP(S) URLs.`);
  if (url.username || url.password) throw new HostExecutionForbiddenError('Host execution URLs cannot contain embedded credentials.');
  if (isMetadataAddress(url.hostname)) throw new HostExecutionForbiddenError('Host execution blocks link-local and cloud metadata endpoints.');
  if (!allowedOrigins.has(url.origin)) throw new HostExecutionForbiddenError(`Origin ${url.origin} is not allowed for host execution.`);
}
""",
    """export function assertHostExecutionUrlAllowed(url: URL, allowedOrigins: Set<string>): void {
  const policy = createHostExecutionTargetPolicy({ allowedOrigins: [...allowedOrigins] });
  if (!policy.allowedProtocols.includes(url.protocol as 'http:' | 'https:')) throw new HostExecutionForbiddenError(`Host execution only allows HTTP(S) URLs.`);
  if (url.username || url.password) throw new HostExecutionForbiddenError('Host execution URLs cannot contain embedded credentials.');
  if (isMetadataAddress(url.hostname)) throw new HostExecutionForbiddenError('Host execution blocks link-local and cloud metadata endpoints.');
  if (!isHostExecutionOriginAllowed(url, policy)) throw new HostExecutionForbiddenError(`Origin ${url.origin} is not allowed for host execution.`);
}
""",
)

# Prove backend behavior is derived from the same shared normalization contract.
replace_once(
    'packages/backend/src/host-execution-route.test.ts',
    "import { hostExecutionRequestOrigin, parseHostExecutionRequestBody, runHostExecutionRoute } from './host-execution-route';\n",
    "import { hostExecutionRequestOrigin, parseHostExecutionRequestBody, runHostExecutionRoute } from './host-execution-route';\nimport { createHostExecutionTargetPolicy } from './shared/host-execution-policy';\n",
)

marker = """  it('derives the docs origin without trusting an arbitrary renderer draft header', () => {
"""
insert = """  it('uses the shared target policy for explicit origin normalization', () => {
    const configured = [
      'https://API.EXAMPLE.TEST/v1?token=ignored',
      'https://api.example.test/other',
      'ftp://api.example.test/not-allowed',
    ];
    const state = createHostExecutionState({ allowedOrigins: configured });
    const expected = createHostExecutionTargetPolicy({ allowedOrigins: configured }).allowedOrigins;
    expect([...allowedHostExecutionOrigins(state, {}, 'https://docs.example.test')]).toEqual(expected);
    expect(expected).toEqual(['https://api.example.test']);
  });

""" + marker
replace_once('packages/backend/src/host-execution-route.test.ts', marker, insert)
