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

const pythonProject = read('adapters/python/pyproject.toml');
const pythonVersion = pythonProject.match(/\[project\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
if (!pythonVersion) fail('Unable to read Python adapter version');

const rustCargo = read('adapters/rust/Cargo.toml');
const rustVersion = rustCargo.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
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
  ['examples/java-spring/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-quarkus/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-micronaut/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-guice/pom.xml', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/go-net-http/go.mod', `github.com/prauga/flexdoc/adapters/go v${goVersion}`],
  ['examples/rust-axum/Cargo.toml', `prauga-flexdoc-axum = "${rustVersion}"`],

  ['examples/javascript-express/README.md', `pinned to \`${backendVersion}\``],
  ['examples/javascript-fastify/README.md', `pinned to \`${backendVersion}\``],
  ['examples/python-fastapi/README.md', `pinned to \`${pythonVersion}\``],
  ['examples/java-spring/README.md', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-quarkus/README.md', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-micronaut/README.md', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/java-guice/README.md', `<flexdoc.version>${javaVersion}</flexdoc.version>`],
  ['examples/go-net-http/README.md', `adapters/go v${goVersion}`],
  ['examples/rust-axum/README.md', `pinned to \`${rustVersion}\``],

  ['examples/README.md', `| [\`javascript-express\`](./javascript-express) | \`@prauga/flexdoc-backend\` \`${backendVersion}\` |`],
  ['examples/README.md', `| [\`javascript-fastify\`](./javascript-fastify) | \`@prauga/flexdoc-backend\` \`${backendVersion}\` |`],
  ['examples/README.md', `| [\`python-fastapi\`](./python-fastapi) | \`prauga-flexdoc\` \`${pythonVersion}\` |`],
  ['examples/README.md', `| [\`java-spring\`](./java-spring) | \`com.prauga.flexdoc:flexdoc-spring-boot-starter\` \`${javaVersion}\` |`],
  ['examples/README.md', `| [\`java-quarkus\`](./java-quarkus) | Quarkus + \`com.prauga.flexdoc:flexdoc-jaxrs\` \`${javaVersion}\` |`],
  ['examples/README.md', `| [\`java-micronaut\`](./java-micronaut) | Micronaut + \`com.prauga.flexdoc:flexdoc-jvm\` \`${javaVersion}\` |`],
  ['examples/README.md', `| [\`java-guice\`](./java-guice) | Guice/JDK HTTP + \`com.prauga.flexdoc:flexdoc-jvm\` \`${javaVersion}\` |`],
  ['examples/README.md', `| [\`go-net-http\`](./go-net-http) | \`github.com/prauga/flexdoc/adapters/go\` \`v${goVersion}\` |`],
  ['examples/README.md', `| [\`rust-axum\`](./rust-axum) | \`prauga-flexdoc-axum\` \`${rustVersion}\` |`],
  ['examples/README.md', `| [\`basic-usage\`](./basic-usage) | React + \`@prauga/flexdoc-client\` \`${clientVersion}\` |`],
  ['examples/README.md', `| [\`interactive-demo\`](./interactive-demo) | React + \`@prauga/flexdoc-client\` \`${clientVersion}\` |`],
  ['examples/README.md', `| [\`api-client\`](./api-client) | Full API Client + \`@prauga/flexdoc-client\` \`${clientVersion}\` |`],
  ['examples/README.md', `| [\`nestjs\`](./nestjs) | NestJS + \`@prauga/flexdoc-backend\` \`${backendVersion}\` |`],

  ['README.md', `| npm | \`@prauga/flexdoc-client\` | \`${clientVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-backend\` | \`${backendVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-core\` | \`${coreVersion}\` |`],
  ['README.md', `| npm | \`@prauga/flexdoc-cli\` | \`${cliVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jvm\` | \`${javaVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-jaxrs\` | \`${javaVersion}\` |`],
  ['README.md', `| Maven | \`com.prauga.flexdoc:flexdoc-spring-boot-starter\` | \`${javaVersion}\` |`],
  ['README.md', `| PyPI | \`prauga-flexdoc\` | \`${pythonVersion}\` |`],
  ['README.md', `| crates.io | \`prauga-flexdoc-axum\` | \`${rustVersion}\` |`],
  ['README.md', `| Go | \`github.com/prauga/flexdoc/adapters/go\` | \`${goVersion}\` |`],
];

for (const [path, expected] of checks) {
  const content = read(path);
  if (!content.includes(expected)) fail(`${path} is stale: expected ${expected}`);
}

if (read('examples/go-net-http/showcase-openapi.json') !== read('examples/showcase-openapi.json')) {
  fail('examples/go-net-http/showcase-openapi.json is stale; copy examples/showcase-openapi.json so the embedded Go showcase stays in sync');
}

console.log(`Examples, lockfiles and README version tables match current FlexDoc versions: client ${clientVersion}, backend ${backendVersion}, core ${coreVersion}, CLI ${cliVersion}, Java ${javaVersion}, Python ${pythonVersion}, Go ${goVersion}, Rust ${rustVersion}`);
