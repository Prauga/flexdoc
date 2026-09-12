import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = path.join(root, 'packages/client/dist/standalone');
const destinations = [
  path.join(root, 'adapters/go/assets'),
  path.join(root, 'adapters/python/src/prauga_flexdoc/_assets'),
  path.join(root, 'adapters/rust/assets'),
  path.join(root, 'adapters/php/assets'),
  path.join(root, 'adapters/ruby/assets'),
  path.join(root, 'adapters/rust-actix/assets'),
  path.join(root, 'adapters/elixir/assets'),
];
const files = ['flexdoc.standalone.js', 'flexdoc.standalone.css'];
const check = process.argv.includes('--check');
const problems = [];

for (const file of files) await access(path.join(source, file));

for (const destination of destinations) {
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const from = path.join(source, file);
    const to = path.join(destination, file);
    if (check) {
      let actual;
      try {
        actual = await readFile(to);
      } catch {
        problems.push(`Missing generated adapter asset: ${path.relative(root, to)}`);
        continue;
      }
      const expected = await readFile(from);
      if (!actual.equals(expected)) problems.push(`Stale adapter asset: ${path.relative(root, to)}`);
    } else {
      await copyFile(from, to);
    }
  }
}

if (check && problems.length > 0) {
  throw new Error(`${problems.join('\n')}\nRun npm run sync:adapter-assets.`);
}

console.log(check ? 'Adapter renderer assets match the canonical standalone build.' : 'Synchronized adapter renderer assets.');
