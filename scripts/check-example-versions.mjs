import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(message); };

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
  const pom = read(path);
  if (!pom.includes(`<version>${javaVersion}</version>`)) fail(`${path} is not aligned to Java family ${javaVersion}`);
}

const dotnetVersion = read('adapters/dotnet/src/Prauga.FlexDoc.AspNetCore/Prauga.FlexDoc.AspNetCore.csproj').match(/<Version>([^<]+)<\/Version>/)?.[1];
const pythonVersion = read('adapters/python/pyproject.toml').match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const phpVersion = read('adapters/php/VERSION').trim();
const rubyVersion = read('adapters/ruby/lib/prauga/flexdoc/version.rb').match(/VERSION = "([^"]+)"/)?.[1];
const rustAxumVersion = read('adapters/rust/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const rustActixVersion = read('adapters/rust-actix/Cargo.toml').match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
const goVersion = read('adapters/go/VERSION').trim();
const elixirVersion = read('adapters/elixir/mix.exs').match(/@version\s+"([^"]+)"/)?.[1];
for (const [name, version] of Object.entries({dotnetVersion, pythonVersion, phpVersion, rubyVersion, rustAxumVersion, rustActixVersion, goVersion, elixirVersion})) {
  if (!version) fail(`Unable to read ${name}`);
}

// Release-candidate branches advance source manifests before registry artifacts
// exist. Standalone examples must remain installable from the last published
// versions until the post-publish lock-refresh PR.
const published = {
  client: '2.9.9',
  backend: '2.9.9',
  dotnet: '0.4.1',
  java: '0.7.1',
  python: '0.6.1',
  php: '0.4.1',
  ruby: '0.4.1',
  rustAxum: '0.5.1',
  rustActix: '0.4.1',
  go: '0.5.1',
  elixir: '0.4.1',
};

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

  ['examples/javascript-express/README.md', `pinned to \`${published.backend}\``],
  ['examples/javascript-fastify/README.md', `pinned to \`${published.backend}\``],
  ['examples/javascript-hono/README.md', `\`@prauga/flexdoc-backend\` \`${published.backend}\``],
  ['examples/dotnet-aspnetcore/README.md', `\`Prauga.FlexDoc.AspNetCore\` \`${published.dotnet}\``],
  ['examples/python-fastapi/README.md', `pinned to \`${published.python}\``],
  ['examples/python-flask/README.md', `pinned to \`${published.python}\``],
  ['examples/python-django/README.md', `pinned to \`${published.python}\``],
  ['examples/php-laravel/README.md', `Install \`prauga/flexdoc\` \`${published.php}\``],
  ['examples/php-laravel/README.md', `composer require prauga/flexdoc:${published.php}`],
  ['examples/php-symfony/README.md', `Install \`prauga/flexdoc\` \`${published.php}\``],
  ['examples/java-spring/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-quarkus/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-micronaut/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/java-guice/README.md', `<flexdoc.version>${published.java}</flexdoc.version>`],
  ['examples/go-net-http/README.md', `adapters/go v${published.go}`],
  ['examples/rust-axum/README.md', `pinned to \`${published.rustAxum}\``],

  ['examples/README.md', `| [\`basic-usage\`](./basic-usage) | React + \`@prauga/flexdoc-client\` \`${published.client}\` |`],
  ['examples/README.md', `| [\`interactive-demo\`](./interactive-demo) | React + \`@prauga/flexdoc-client\` \`${published.client}\` |`],
  ['examples/README.md', `| [\`api-client\`](./api-client) | Full API Client + \`@prauga/flexdoc-client\` \`${published.client}\` |`],
  ['examples/README.md', `| [\`nestjs\`](./nestjs) | NestJS + \`@prauga/flexdoc-backend\` \`${published.backend}\` |`],
  ['examples/README.md', `| [\`javascript-express\`](./javascript-express) | Express + \`@prauga/flexdoc-backend\` \`${published.backend}\` |`],
  ['examples/README.md', `| [\`javascript-fastify\`](./javascript-fastify) | Fastify + \`@prauga/flexdoc-backend\` \`${published.backend}\` |`],
  ['examples/README.md', `| [\`javascript-hono\`](./javascript-hono) | Hono + \`@prauga/flexdoc-backend\` \`${published.backend}\` |`],
  ['examples/README.md', `| [\`dotnet-aspnetcore\`](./dotnet-aspnetcore) | \`Prauga.FlexDoc.AspNetCore\` \`${published.dotnet}\` |`],
  ['examples/README.md', `| [\`java-spring\`](./java-spring) | Spring Boot + \`flexdoc-spring-boot-starter\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`java-quarkus\`](./java-quarkus) | Quarkus/Jakarta REST + \`flexdoc-jaxrs\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`java-micronaut\`](./java-micronaut) | Micronaut + \`flexdoc-jvm\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`java-guice\`](./java-guice) | Guice/JDK HTTP + \`flexdoc-jvm\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`kotlin-ktor\`](./kotlin-ktor) | Ktor 3.5.2 + \`flexdoc-jvm\` \`${published.java}\` |`],
  ['examples/README.md', `| [\`python-fastapi\`](./python-fastapi) | FastAPI/ASGI + \`prauga-flexdoc\` \`${published.python}\` |`],
  ['examples/README.md', `| [\`python-flask\`](./python-flask) | Flask/WSGI + \`prauga-flexdoc\` \`${published.python}\` |`],
  ['examples/README.md', `| [\`python-django\`](./python-django) | Django + \`prauga-flexdoc\` \`${published.python}\` |`],
  ['examples/README.md', `| [\`php-laravel\`](./php-laravel) | Laravel + \`prauga/flexdoc\` \`${published.php}\` |`],
  ['examples/README.md', `| [\`php-symfony\`](./php-symfony) | Symfony + \`prauga/flexdoc\` \`${published.php}\` |`],
  ['examples/README.md', `| [\`ruby-rack\`](./ruby-rack) | Rack + \`prauga-flexdoc\` gem \`${published.ruby}\` |`],
  ['examples/README.md', `| [\`ruby-rails\`](./ruby-rails) | Rails + \`prauga-flexdoc\` gem \`${published.ruby}\` |`],
  ['examples/README.md', `| [\`go-net-http\`](./go-net-http) | Go \`net/http\` adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`go-gin\`](./go-gin) | Gin over the \`net/http\` adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`go-chi\`](./go-chi) | Chi over the \`net/http\` adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`go-echo\`](./go-echo) | Echo v5 over the \`net/http\` adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`go-fiber\`](./go-fiber) | Fiber v3 direct \`net/http\` adaptation, adapter \`v${published.go}\` |`],
  ['examples/README.md', `| [\`rust-axum\`](./rust-axum) | \`prauga-flexdoc-axum\` \`${published.rustAxum}\` |`],
  ['examples/README.md', `| [\`rust-actix\`](./rust-actix) | \`prauga-flexdoc-actix\` \`${published.rustActix}\` |`],
  ['examples/README.md', `| [\`elixir-phoenix\`](./elixir-phoenix) | Phoenix forwarding \`prauga_flexdoc\` Plug \`${published.elixir}\` |`],

  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${clientVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${backendVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${coreVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${cliVersion}\` |`],
  ['README.md', `| NuGet | \`Prauga.FlexDoc.AspNetCore\` | \`${dotnetVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${javaVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jaxrs\` | \`${javaVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-spring-boot-starter\` | \`${javaVersion}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${pythonVersion}\` |`],
  ['README.md', `| Composer | \`prauga/flexdoc\` | \`${phpVersion}\` |`],
  ['README.md', `| RubyGems | \`prauga-flexdoc\` | \`${rubyVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${rustAxumVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-actix\` | \`${rustActixVersion}\` |`],
  ['README.md', `| Hex | \`prauga_flexdoc\` | \`${elixirVersion}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${goVersion}\` |`],

  ['docs/distribution.md', `| \`prauga-flexdoc\` (RubyGems) | \`${rubyVersion}\` | \`ruby/v${rubyVersion}\` |`],
  ['docs/distribution.md', `| \`prauga-flexdoc-actix\` | \`${rustActixVersion}\` | \`rust-actix/v${rustActixVersion}\` |`],
  ['docs/distribution.md', `| \`prauga_flexdoc\` (Hex) | \`${elixirVersion}\` | \`elixir/v${elixirVersion}\` |`],
];

for (const [path, expected] of checks) {
  const content = read(path);
  if (!content.includes(expected)) fail(`${path} is stale: expected ${expected}`);
}

if (read('examples/go-net-http/showcase-openapi.json') !== read('examples/showcase-openapi.json')) {
  fail('examples/go-net-http/showcase-openapi.json is stale; copy examples/showcase-openapi.json so the embedded Go showcase stays in sync');
}

console.log(`Examples, lockfiles, Java modules, and README version tables match current FlexDoc versions: client ${clientVersion}, backend ${backendVersion}, core ${coreVersion}, CLI ${cliVersion}, .NET ${dotnetVersion}, Java ${javaVersion}, Python ${pythonVersion}, PHP ${phpVersion}, Ruby ${rubyVersion}, Go ${goVersion}, Rust ${rustAxumVersion}/${rustActixVersion}, Elixir ${elixirVersion}`);
