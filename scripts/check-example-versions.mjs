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
};
for (const [name, version] of Object.entries(sourceVersions)) {
  if (!version) fail(`Unable to read ${name} version`);
}

// Standalone examples track the immutable registry artifacts published for FlexDoc 3.3.
// Repository CI may substitute packages built from the current commit when validating source changes.
const published = {
  client: clientVersion,
  backend: backendVersion,
  dotnet: '0.5.3',
  java: '0.8.3',
  python: '0.7.3',
  php: '0.4.5',
  ruby: '0.4.5',
  rustAxum: '0.5.5',
  rustActix: '0.4.5',
  rustHost: '0.1.0',
  go: '0.5.5',
  elixir: '0.4.5',
};

for (const [name, version] of Object.entries(sourceVersions)) {
  if (version !== published[name]) fail(`Published 3.3 ${name} baseline ${published[name]} does not match source version ${version}`);
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

  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${clientVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${backendVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${coreVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${cliVersion}\` |`],
  ['README.md', `| NuGet | \`Prauga.FlexDoc.AspNetCore\` | \`${sourceVersions.dotnet}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${sourceVersions.java}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${sourceVersions.python}\` |`],
  ['README.md', `| Composer | \`prauga/flexdoc\` | \`${sourceVersions.php}\` |`],
  ['README.md', `| RubyGems | \`prauga-flexdoc\` | \`${sourceVersions.ruby}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${sourceVersions.rustAxum}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-actix\` | \`${sourceVersions.rustActix}\` |`],
  ['README.md', `| Hex | \`prauga_flexdoc\` | \`${sourceVersions.elixir}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${sourceVersions.go}\` |`],

  ['docs/distribution.md', `| \`Prauga.FlexDoc.AspNetCore\` | \`${sourceVersions.dotnet}\` | \`dotnet/v${sourceVersions.dotnet}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc\` (RubyGems) | \`${sourceVersions.ruby}\` | \`ruby/v${sourceVersions.ruby}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-axum\` | \`${sourceVersions.rustAxum}\` | \`rust/v${sourceVersions.rustAxum}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-actix\` | \`${sourceVersions.rustActix}\` | \`rust-actix/v${sourceVersions.rustActix}\` |`],
  ['docs/distribution.md', `| \`prauga_flexdoc\` (Hex) | \`${sourceVersions.elixir}\` | \`elixir/v${sourceVersions.elixir}\` |`],
];

for (const [path, expected] of checks) expect(path, expected);

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

console.log(`Examples and generated dependency metadata match FlexDoc 3.3 published versions: client ${clientVersion}, backend ${backendVersion}, .NET ${published.dotnet}, Java ${published.java}, Python ${published.python}, PHP/Ruby/Elixir ${published.php}/${published.ruby}/${published.elixir}, Go ${published.go}, Rust ${published.rustAxum}/${published.rustActix} + host ${published.rustHost}`);
