import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;
const coreVersion = json('core/package.json').version;
const cliVersion = json('tools/flexdoc-cli/package.json').version;
const coreLock = json('core/package-lock.json');
if (coreLock.version !== coreVersion || coreLock.packages?.['']?.version !== coreVersion) fail(`core/package-lock.json is stale: expected ${coreVersion}`);

const javaPom = read('adapters/java/pom.xml');
const javaVersion = javaPom.match(/<artifactId>flexdoc-java-reactor<\/artifactId>\s*<version>([^<]+)<\/version>/)?.[1];
if (!javaVersion) fail('Unable to read Java family version');

const pythonVersion = read('adapters/python/pyproject.toml').match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
if (!pythonVersion) fail('Unable to read Python adapter version');
const phpVersion = read('adapters/php/VERSION').trim();
if (!phpVersion) fail('Unable to read PHP adapter version');
const rustVersion = read('adapters/rust/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
if (!rustVersion) fail('Unable to read Rust adapter version');
const goVersion = read('adapters/go/VERSION').trim();
if (!goVersion) fail('Unable to read Go adapter version');

const checks = [
  ['examples/basic-usage/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/interactive-demo/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/api-client/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/nestjs/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-express/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-fastify/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/python-fastapi/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/python-flask/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/python-django/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/php-laravel/composer.json', `"prauga/flexdoc": "${phpVersion}"`],
  ['examples/php-symfony/composer.json', `"prauga/flexdoc": "${phpVersion}"`],
  ['examples/java-spring/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-quarkus/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-micronaut/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-guice/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/go-net-http/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/rust-axum/Cargo.toml', `prauga-flexdoc-axum = "${rustVersion}"`],
  ['examples/python-fastapi/README.md', `pinned to \`${pythonVersion}\``],
  ['examples/python-flask/README.md', `pinned to \`${pythonVersion}\``],
  ['examples/python-django/README.md', `pinned to \`${pythonVersion}\``],
  ['examples/php-laravel/README.md', `\`${phpVersion}\``],
  ['examples/php-symfony/README.md', `\`${phpVersion}\``],
  ['examples/README.md', `| [\`php-laravel\`](./php-laravel) | Laravel + \`prauga/flexdoc\` \`${phpVersion}\` |`],
  ['examples/README.md', `| [\`php-symfony\`](./php-symfony) | Symfony + \`prauga/flexdoc\` \`${phpVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${clientVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${backendVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${coreVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${cliVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${javaVersion}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${pythonVersion}\` |`],
  ['README.md', `| Composer | \`prauga/flexdoc\` | \`${phpVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${rustVersion}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${goVersion}\` |`],
];

for (const [path, expected] of checks) {
  if (!read(path).includes(expected)) fail(`${path} is stale: expected ${expected}`);
}

if (read('examples/go-net-http/showcase-openapi.json') !== read('examples/showcase-openapi.json')) fail('Go showcase OpenAPI copy is stale');
console.log(`Examples and version tables match: client ${clientVersion}, backend ${backendVersion}, Java ${javaVersion}, Python ${pythonVersion}, PHP ${phpVersion}, Go ${goVersion}, Rust ${rustVersion}`);
