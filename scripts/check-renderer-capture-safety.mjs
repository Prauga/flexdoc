import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');
const captureWorkflow = 'renderer-capture.yml';
const problems = [];

const workflowFiles = (await readdir(workflowsDir))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

for (const name of workflowFiles) {
  const content = await readFile(path.join(workflowsDir, name), 'utf8');
  const pushesHeadRef = /git\s+push[^\n]*GITHUB_HEAD_REF|GITHUB_HEAD_REF[^\n]*git\s+push/i.test(content);
  if (pushesHeadRef) {
    problems.push(`${name}: workflows must never push to GITHUB_HEAD_REF / the active PR branch`);
  }

  if (name !== captureWorkflow && /sync:adapter-assets/.test(content) && /git\s+push/.test(content)) {
    problems.push(`${name}: only ${captureWorkflow} may combine adapter-asset synchronization with git push`);
  }
}

const capturePath = path.join(workflowsDir, captureWorkflow);
let capture;
try {
  capture = await readFile(capturePath, 'utf8');
} catch {
  problems.push(`Missing required safe renderer capture workflow: .github/workflows/${captureWorkflow}`);
}

if (capture) {
  const requiredFragments = [
    'capture/renderer/',
    'source_sha',
    'capture_branch',
    'git diff --cached --name-only',
    'adapters/go/assets/flexdoc.standalone.js',
    'adapters/python/src/prauga_flexdoc/_assets/flexdoc.standalone.js',
    'adapters/rust/assets/flexdoc.standalone.js',
    'adapters/php/assets/flexdoc.standalone.js',
    'adapters/ruby/assets/flexdoc.standalone.js',
    'adapters/rust-actix/assets/flexdoc.standalone.js',
    'adapters/elixir/assets/flexdoc.standalone.js',
  ];
  for (const fragment of requiredFragments) {
    if (!capture.includes(fragment)) problems.push(`${captureWorkflow}: missing safety contract fragment: ${fragment}`);
  }
  if (/GITHUB_HEAD_REF/.test(capture)) {
    problems.push(`${captureWorkflow}: must not reference GITHUB_HEAD_REF`);
  }
  if (/git\s+add\s+adapters(?:\s|$)/m.test(capture)) {
    problems.push(`${captureWorkflow}: broad "git add adapters" is forbidden; stage only the canonical allowlist`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log('Renderer capture workflows obey stacked-PR branch safety invariants.');
