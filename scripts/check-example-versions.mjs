import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;

const javaPom = read('adapters/java-spring/pom.xml');
const javaVersion = javaPom.match(/<artifactId>flexdoc-spring-boot-starter<\/artifactId>\s*<version>([^<]+)<\/version>/)?.[1]
  || javaPom.match(/<version>([^<]+)<\/version>/)?.[1];
if (!javaVersion) fail('Unable to read Java adapter version');

const pythonProject = read('adapters/python/pyproject.toml');
const pythonVersion = pythonProject.match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
if (!pythonVersion) fail('Unable to read Python adapter version');

const rustCargo = read('adapters/rust/Cargo.toml');
const rustVersion = rustCargo.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
if (!rustVersion) fail('Unable to read Rust adapter version');

const goVersion = read('adapters/go/VERSION').trim();
if (!goVersion) fail('Unable to read Go adapter version');

const checks = [
  ['packages/examples/basic-usage/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['packages/examples/interactive-demo/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['packages/examples/nestjs/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-express/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-fastify/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/python-fastapi/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/java-spring/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/go-net-http/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/rust-axum/Cargo.toml', `prauga-flexdoc-axum = "${rustVersion}"`],
];

for (const [path, expected] of checks) {
  const content = read(path);
  if (!content.includes(expected)) {
    fail(`${path} is stale: expected ${expected}`);
  }
}

console.log(`Examples match current FlexDoc versions: client ${clientVersion}, backend ${backendVersion}, Java ${javaVersion}, Python ${pythonVersion}, Go ${goVersion}, Rust ${rustVersion}`);
