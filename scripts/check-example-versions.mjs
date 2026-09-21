import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };
const expect = (path, expected) => {
  if (!read(path).includes(expected)) fail(`${path} is stale: expected ${expected}`);
};

const clientVersion = json('packages/client/package.json').version;
const backendVersion = json('packages/backend/package.json').version;
const coreVersion = json('core/package.json').version;
const cliVersion = json('tools/flexdoc-cli/package.json').version;

const coreLock = json('core/package-lock.json');
if (coreLock.version !== coreVersion || coreLock.packages?.['']?.version !== coreVersion) {
  fail(`core/package-lock.json is stale: expected @prauga/flexdoc-core ${coreVersion}`);
}

const javaFamilyPom = read('adapters/java/pom.xml');
const javaVersion = javaFamilyPom.match(/<artifactId>flexdoc-java-reactor<\/artifactId>\s*<version>([^<]+)<\/version>/)?.[1]
  || javaFamilyPom.match(/<version>([^<]+)<\/version>/)?.[1];
if (!javaVersion) fail('Unable to read Java family version');
for (const path of ['adapters/java-jvm/pom.xml', 'adapters/java-jaxrs/pom.xml', 'adapters/java-spring/pom.xml']) {
  if (!read(path).includes(`<version>${javaVersion}</version>`)) fail(`${path} is not aligned to Java family ${javaVersion}`);
}

const sourceVersions = {
  dotnet: read('adapters/dotnet/src/Prauga.FlexDoc.AspNetCore/Prauga.FlexDoc.AspNetCore.csproj').match(/<Version>([^<]+)<\/Version>/)?.[1],
  java: javaVersion,
  python: read('adapters/python/pyproject.toml').match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1],
  php: read('adapters/php/VERSION').trim(),
  ruby: read('adapters/ruby/lib/prauga/flexdoc/version.rb').match(/VERSION = "([^"]+)"/)?.[1],
  rustAxum: read('adapters/rust/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1],
  rustActix: read('adapters/rust-actix/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1],
  go: read('adapters/go/VERSION').trim(),
  elixir: read('adapters/elixir/mix.exs').match(/@version\s+"([^"]+)"/)?.[1],
  rustHost: read('adapters/rust-host-execution/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1],
};
for (const [name, version] of Object.entries(sourceVersions)) {
  if (!version) fail(`Unable to read ${name} version`);
}

// Standalone examples track the immutable registry artifacts published for FlexDoc 3.3.
// Repository CI may substitute packages built from the current commit when validating source changes.
const published = {
  client: '3.3.1',
  backend: '3.3.1',
  core: '0.5.2',
  cli: '0.7.0',
  dotnet: '0.6.0',
  java: '0.9.0',
  python: '0.8.0',
  php: '0.4.6',
  ruby: '0.4.6',
  rustAxum: '0.5.6',
  rustActix: '0.4.6',
  rustHost: '0.1.1',
  go: '0.5.6',
  elixir: '0.4.6',
};

// A release cannot be prepared and pinned in one commit: registries only serve an
// artifact after its tag is published, and go.sum/Cargo.lock/package-lock entries
// need those artifacts to exist. `pending` names the version being prepared, which
// is the only value a source tree may hold other than the published baseline.
// Examples stay pinned to `published` until the artifacts ship and a follow-up
// commit repins them and clears the entry here.
const pending = {
  // 3.3.5 publishes the observability exports that the documentation already
  // describes: reason categories and the host recorder, plus the browser-side
  // transport observation. Adapters carry the rebuilt renderer only.
  client: '3.3.5',
  backend: '3.3.5',
  python: '0.8.1',
  ruby: '0.4.7',
  elixir: '0.4.7',
  php: '0.4.7',
  go: '0.5.7',
  rustAxum: '0.5.7',
  rustActix: '0.4.7',
};

for (const name of Object.keys(pending)) {
  if (!(name in published)) fail(`pending lists unknown package ${name}`);
  if (pending[name] === published[name]) fail(`pending ${name} ${pending[name]} is already published; drop the entry`);
}

for (const [name, version] of Object.entries(sourceVersions)) {
  const expected = pending[name] ?? published[name];
  if (version !== expected) {
    fail(pending[name]
      ? `Pending 3.3 ${name} release ${expected} does not match source version ${version}`
      : `Published 3.3 ${name} baseline ${expected} does not match source version ${version}`);
  }
}

// The npm packages are not in sourceVersions because they are read above for the
// lockfile checks, so hold them to the same baseline rule here.
for (const [name, version] of Object.entries({
  client: clientVersion,
  backend: backendVersion,
  core: coreVersion,
  cli: cliVersion,
})) {
  const expected = pending[name] ?? published[name];
  if (version !== expected) fail(`${name} baseline ${expected} does not match source version ${version}`);
}

for (const path of [
  'examples/javascript-express/package-lock.json',
  'examples/javascript-fastify/package-lock.json',
  'examples/javascript-hono/package-lock.json',
]) {
  const lock = json(path);
  const declared = lock.packages?.['']?.dependencies?.['@prauga/flexdoc-backend'];
  const resolved = lock.packages?.['node_modules/@prauga/flexdoc-backend']?.version;
  if (declared !== published.backend || resolved !== published.backend) {
    fail(`${path} is stale: expected @prauga/flexdoc-backend ${published.backend} in root dependency and resolved package`);
  }
}

const checks = [
  ['examples/basic-usage/package.json', `"@prauga/flexdoc-client": "${published.client}"`],
  ['examples/interactive-demo/package.json', `"@prauga/flexdoc-client": "${published.client}"`],
  ['examples/api-client/package.json', `"@prauga/flexdoc-client": "${published.client}"`],
  ['examples/nestjs/package.json', `"@prauga/flexdoc-backend": "${published.backend}"`],
  ['examples/javascript-express/package.json', `"@prauga/flexdoc-backend": "${published.backend}"`],
  ['examples/javascript-fastify/package.json', `"@prauga/flexdoc-backend": "${published.backend}"`],
  ['examples/javascript-hono/package.json', `"@prauga/flexdoc-backend": "${published.backend}"`],
  ['examples/python-fastapi/requirements.txt', `prauga-flexdoc==${published.python}`],
  ['examples/python-flask/requirements.txt', `prauga-flexdoc==${published.python}`],
  ['examples/python-django/requirements.txt', `prauga-flexdoc==${published.python}`],
  ['examples/php-laravel/composer.json', `"prauga/flexdoc": "${published.php}"`],
  ['examples/php-symfony/composer.json', `"prauga/flexdoc": "${published.php}"`],
  ['examples/ruby-rack/Gemfile', `gem "prauga-flexdoc", "${published.ruby}"`],
  ['examples/ruby-rails/Gemfile', `gem "prauga-flexdoc", "${published.ruby}"`],
  ['examples/java-spring/pom.xml', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-quarkus/pom.xml', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-micronaut/pom.xml', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-guice/pom.xml', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/kotlin-ktor/pom.xml', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/go-net-http/go.mod', `github.com/prauga/flexdoc/adapters/go v${published.go}`],
  ['examples/go-gin/go.mod', `github.com/prauga/flexdoc/adapters/go v${published.go}`],
  ['examples/go-chi/go.mod', `github.com/prauga/flexdoc/adapters/go v${published.go}`],
  ['examples/go-echo/go.mod', `github.com/prauga/flexdoc/adapters/go v${published.go}`],
  ['examples/go-fiber/go.mod', `github.com/prauga/flexdoc/adapters/go v${published.go}`],
  ['examples/rust-axum/Cargo.toml', `prauga-flexdoc-axum = "${published.rustAxum}"`],
  ['examples/rust-actix/Cargo.toml', `prauga-flexdoc-actix = "${published.rustActix}"`],
  ['examples/elixir-phoenix/README.md', `{:prauga_flexdoc, "${published.elixir}"}`],

  ['examples/dotnet-aspnetcore/README.md', `\`Prauga.FlexDoc.AspNetCore\` \`${published.dotnet}\``],
  ['examples/java-spring/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-quarkus/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-micronaut/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-guice/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/kotlin-ktor/README.md', `\`FlexDocHost\` \`${published.java}\``],
  ['examples/python-fastapi/README.md', `pinned to \`${published.python}\``],
  ['examples/python-flask/README.md', `\`prauga-flexdoc\` \`${published.python}\``],
  ['examples/python-django/README.md', `\`prauga-flexdoc\` \`${published.python}\``],
  ['examples/php-laravel/README.md', `Install \`prauga/flexdoc\` \`${published.php}\``],
  ['examples/php-laravel/README.md', `composer require prauga/flexdoc:${published.php}`],
  ['examples/php-symfony/README.md', `Install \`prauga/flexdoc\` \`${published.php}\``],
  ['examples/ruby-rack/README.md', `\`prauga-flexdoc\` \`${published.ruby}\``],
  ['examples/ruby-rails/README.md', `\`prauga-flexdoc\` \`${published.ruby}\``],
  ['examples/go-net-http/README.md', `adapters/go v${published.go}`],
  ['examples/rust-axum/README.md', `pinned to \`${published.rustAxum}\``],
  ['examples/rust-actix/README.md', `\`prauga-flexdoc-actix\` \`${published.rustActix}\``],

  ['examples/README.md', `| [\`dotnet-aspnetcore\`](./dotnet-aspnetcore) | \`Prauga.FlexDoc.AspNetCore\` \`${published.dotnet}\` |`],
  ['examples/README.md', `| [\`java-spring\`](./java-spring) | Spring Boot + \`flexdoc-spring-boot-starter\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`python-fastapi\`](./python-fastapi) | FastAPI/ASGI + \`prauga-flexdoc\` \`${published.python}\` |`],
  ['examples/README.md', `| [\`php-laravel\`](./php-laravel) | Laravel + \`prauga/flexdoc\` \`${published.php}\` |`],
  ['examples/README.md', `| [\`ruby-rack\`](./ruby-rack) | Rack + \`prauga-flexdoc\` gem \`${published.ruby}\` |`],
  ['examples/README.md', `| [\`go-net-http\`](./go-net-http) | Go \`net/http\` adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`rust-axum\`](./rust-axum) | \`prauga-flexdoc-axum\` \`${published.rustAxum}\` |`],
  ['examples/README.md', `| [\`rust-actix\`](./rust-actix) | \`prauga-flexdoc-actix\` \`${published.rustActix}\` |`],
  ['examples/README.md', `| [\`elixir-phoenix\`](./elixir-phoenix) | Phoenix forwarding \`prauga_flexdoc\` Plug \`${published.elixir}\` |`],

  // Registry tables describe what a user can install today, so they track the
  // published baselines rather than the source tree, which may be a release ahead.
  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${published.client}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${published.backend}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${published.core}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${published.cli}\` |`],
  ['README.md', `| NuGet | \`Prauga.FlexDoc.AspNetCore\` | \`${published.dotnet}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${published.java}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${published.python}\` |`],
  ['README.md', `| Composer | \`prauga/flexdoc\` | \`${published.php}\` |`],
  ['README.md', `| RubyGems | \`prauga-flexdoc\` | \`${published.ruby}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${published.rustAxum}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-actix\` | \`${published.rustActix}\` |`],
  ['README.md', `| Hex | \`prauga_flexdoc\` | \`${published.elixir}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${published.go}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-host-execution\` | \`${published.rustHost}\` |`],

  ['docs/distribution.md', `| \`@prauga/flexdoc-client\` | \`${published.client}\` | \`js/v${published.client}\` |`],
  ['docs/distribution.md', `| \`@prauga/flexdoc-backend\` | \`${published.backend}\` | \`js/v${published.backend}\` |`],
  ['docs/distribution.md', `| \`@prauga/flexdoc-core\` | \`${published.core}\` | \`core/v${published.core}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc\` (PyPI) | \`${published.python}\` | \`python/v${published.python}\` |`],
  ['docs/distribution.md', `| \`prauga/flexdoc\` | \`${published.php}\` | \`Prauga/flexdoc-php\` \`v${published.php}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-host-execution\` | \`${published.rustHost}\` | \`rust-host/v${published.rustHost}\` |`],
  ['docs/distribution.md', `| \`github.com/prauga/flexdoc/adapters/go\` | \`${published.go}\` | \`adapters/go/v${published.go}\` |`],
  ['docs/distribution.md', `| \`Prauga.FlexDoc.AspNetCore\` | \`${published.dotnet}\` | \`dotnet/v${published.dotnet}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc\` (RubyGems) | \`${published.ruby}\` | \`ruby/v${published.ruby}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-axum\` | \`${published.rustAxum}\` | \`rust/v${published.rustAxum}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-actix\` | \`${published.rustActix}\` | \`rust-actix/v${published.rustActix}\` |`],
  ['docs/distribution.md', `| \`prauga_flexdoc\` (Hex) | \`${published.elixir}\` | \`elixir/v${published.elixir}\` |`],
];

for (const [path, expected] of checks) expect(path, expected);

// Every row of the examples table must name the published version of the package
// it installs. The checks above cover one row per ecosystem, which let eleven of
// the other rows drift as far as two releases behind before anyone noticed. An
// unrecognized row fails too, so a new example cannot be added ungated.
const rowBaselines = [
  [/^\| \[`(basic-usage|interactive-demo|api-client)`\]/, published.client, '@prauga/flexdoc-client'],
  [/^\| \[`(nestjs|javascript-[a-z]+)`\]/, published.backend, '@prauga/flexdoc-backend'],
  [/^\| \[`dotnet-/, published.dotnet, 'Prauga.FlexDoc.AspNetCore'],
  [/^\| \[`(java|kotlin)-/, published.java, 'the Java family'],
  [/^\| \[`python-/, published.python, 'prauga-flexdoc (PyPI)'],
  [/^\| \[`php-/, published.php, 'prauga/flexdoc'],
  [/^\| \[`ruby-/, published.ruby, 'prauga-flexdoc (RubyGems)'],
  [/^\| \[`go-/, published.go, 'the Go adapter'],
  [/^\| \[`rust-axum`\]/, published.rustAxum, 'prauga-flexdoc-axum'],
  [/^\| \[`rust-actix`\]/, published.rustActix, 'prauga-flexdoc-actix'],
  [/^\| \[`elixir-/, published.elixir, 'prauga_flexdoc'],
];

for (const line of read('examples/README.md').split('\n')) {
  if (!line.startsWith('| [`')) continue;
  const name = line.slice(4, line.indexOf('`', 4));
  const baseline = rowBaselines.find(([pattern]) => pattern.test(line));
  if (!baseline) fail(`examples/README.md row \`${name}\` is not covered by a version baseline; add it to rowBaselines`);
  const [, version, label] = baseline;
  if (!line.includes(version)) fail(`examples/README.md row \`${name}\` is stale: expected ${label} ${version}`);
}

for (const dir of ['go-net-http', 'go-gin', 'go-chi', 'go-echo', 'go-fiber']) {
  const sum = read(`examples/${dir}/go.sum`);
  const prefix = `github.com/prauga/flexdoc/adapters/go v${published.go}`;
  if (!sum.includes(`${prefix} h1:`) || !sum.includes(`${prefix}/go.mod h1:`)) {
    fail(`examples/${dir}/go.sum is stale: expected checksums for ${prefix}`);
  }
}

expect('examples/rust-axum/Cargo.lock', `name = "prauga-flexdoc-axum"\nversion = "${published.rustAxum}"`);
expect('examples/rust-axum/Cargo.lock', `name = "prauga-flexdoc-host-execution"\nversion = "${published.rustHost}"`);
expect('examples/rust-actix/Cargo.lock', `name = "prauga-flexdoc-actix"\nversion = "${published.rustActix}"`);
expect('examples/rust-actix/Cargo.lock', `name = "prauga-flexdoc-host-execution"\nversion = "${published.rustHost}"`);

if (read('examples/go-net-http/showcase-openapi.json') !== read('examples/showcase-openapi.json')) {
  fail('examples/go-net-http/showcase-openapi.json is stale; copy examples/showcase-openapi.json so the embedded Go showcase stays in sync');
}

console.log(`Examples and generated dependency metadata match FlexDoc 3.3 published versions: client ${published.client}, backend ${published.backend}, .NET ${published.dotnet}, Java ${published.java}, Python ${published.python}, PHP/Ruby/Elixir ${published.php}/${published.ruby}/${published.elixir}, Go ${published.go}, Rust ${published.rustAxum}/${published.rustActix} + host ${published.rustHost}`);

const pendingList = Object.entries(pending).map(([name, version]) => `${name} ${published[name]} -> ${version}`);
if (pendingList.length) {
  console.log(`Releases in flight (examples repin once published): ${pendingList.join(', ')}`);
}
