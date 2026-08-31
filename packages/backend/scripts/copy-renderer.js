const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '../../client/dist/standalone');
const targetDir = path.resolve(__dirname, '../dist/renderer');
const files = ['flexdoc.standalone.js', 'flexdoc.standalone.css'];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);

  if (!fs.existsSync(source)) {
    throw new Error(
      `Missing ${source}. Build @prauga/flexdoc-client before the backend package.`
    );
  }

  fs.copyFileSync(source, target);
}
