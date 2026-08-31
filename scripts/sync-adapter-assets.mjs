import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = path.join(root, 'packages/client/dist/standalone');
const destinations = [
  path.join(root, 'adapters/go/assets'),
  path.join(root, 'adapters/python/src/prauga_flexdoc/_assets'),
  path.join(root, 'adapters/rust/assets'),
];
const files = ['flexdoc.standalone.js', 'flexdoc.standalone.css'];
const check = process.argv.includes('--check');

for (const file of files) await access(path.join(source, file));

for (const destination of destinations) {
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const from = path.join(source, file);
    const to = path.join(destination, file);
    if (check) {
      let actual;
      try { actual = await readFile(to); } catch { throw new Error(`Missing generated adapter asset: ${path.relative(root, to)}`); }
      const expected = await readFile(from);
      if (!actual.equals(expected)) throw new Error(`Stale adapter asset: ${path.relative(root, to)}. Run npm run sync:adapter-assets.`);
    } else {
      await copyFile(from, to);
    }
  }
}

console.log(check ? 'Adapter renderer assets match the canonical standalone build.' : 'Synchronized adapter renderer assets.');
