import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;
const coreVersion = json('core/package.json').version;
const cliVersion = json('tools/flexdoc-cli/package.json').version;
const javaVersion = read('adapters/java/pom.xml').match(/<artifactId>flexdoc-java-reactor<\/artifactId>\s*<version>([^<]+)<\/version>/)?.[1];
const pythonVersion = read('adapters/python/pyproject.toml').match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const phpVersion = read('adapters/php/VERSION').trim();
const rubyVersion = read('adapters/ruby/lib/prauga/flexdoc/version.rb').match(/VERSION = "([^"]+)"/)?.[1];
const rustAxumVersion = read('adapters/rust/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const rustActixVersion = read('adapters/rust-actix/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const goVersion = read('adapters/go/VERSION').trim();
const elixirVersion = read('adapters/elixir/mix.exs').match(/@version\s+"([^"]+)"/)?.[1];
for (const [name, version] of Object.entries({javaVersion, pythonVersion, phpVersion, rubyVersion, rustAxumVersion, rustActixVersion, goVersion, elixirVersion})) {
  if (!version) fail(`Unable to read ${name}`);
}

const checks = [
  ['examples/basic-usage/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/interactive-demo/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/api-client/package.json', `"@prauga/flexdoc-client": "${clientVersion}"`],
  ['examples/nestjs/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-express/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-fastify/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/javascript-hono/package.json', `"@prauga/flexdoc-backend": "${backendVersion}"`],
  ['examples/python-fastapi/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/python-flask/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/python-django/requirements.txt', `prauga-flexdoc==${pythonVersion}`],
  ['examples/php-laravel/composer.json', `"prauga/flexdoc": "${phpVersion}"`],
  ['examples/php-symfony/composer.json', `"prauga/flexdoc": "${phpVersion}"`],
  ['examples/ruby-rack/Gemfile', `gem "prauga-flexdoc", "${rubyVersion}"`],
  ['examples/ruby-rails/Gemfile', `gem "prauga-flexdoc", "${rubyVersion}"`],
  ['examples/java-spring/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-quarkus/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-micronaut/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-guice/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/kotlin-ktor/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/go-net-http/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/go-gin/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/go-chi/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/go-echo/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/go-fiber/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/rust-axum/Cargo.toml', `prauga-flexdoc-axum = "${rustAxumVersion}"`],
  ['examples/rust-actix/Cargo.toml', `prauga-flexdoc-actix = "${rustActixVersion}"`],
  ['examples/elixir-phoenix/README.md', `{:prauga_flexdoc, "${elixirVersion}"}`],
  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${clientVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${backendVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${coreVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${cliVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${javaVersion}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${pythonVersion}\` |`],
  ['README.md', `| Composer | \`prauga/flexdoc\` | \`${phpVersion}\` |`],
  ['README.md', `| RubyGems | \`prauga-flexdoc\` | \`${rubyVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${rustAxumVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-actix\` | \`${rustActixVersion}\` |`],
  ['README.md', `| Hex | \`prauga_flexdoc\` | \`${elixirVersion}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${goVersion}\` |`],
];
for (const [path, expected] of checks) if (!read(path).includes(expected)) fail(`${path} is stale: expected ${expected}`);

if (read('examples/go-net-http/showcase-openapi.json') !== read('examples/showcase-openapi.json')) fail('Go showcase OpenAPI copy is stale');
console.log(`Version guard passed: JS ${clientVersion}/${backendVersion}, Java ${javaVersion}, Python ${pythonVersion}, PHP ${phpVersion}, Ruby ${rubyVersion}, Go ${goVersion}, Rust ${rustAxumVersion}/${rustActixVersion}, Elixir ${elixirVersion}`);
