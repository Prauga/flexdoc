/**
 * @packageDocumentation
 * Build and serve static FlexDoc documentation sites from OpenAPI files.
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundleExternalReferences } from '@prauga/flexdoc-client';
import yaml from 'js-yaml';

const HELP = `FlexDoc CLI\n\nUsage:\n  flexdoc build <openapi> [--out <dir>] [--base-path <path>] [--title <title>] [--force]\n  flexdoc serve <openapi> [--host <host>] [--port <port>] [--base-path <path>] [--title <title>] [--watch]\n\nInput may be a local .json/.yaml/.yml file or an http(s) URL.\n`;

function normalizeBasePath(value = '/') {
  let path = String(value || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path += '/';
  return path.replace(/\/+/g, '/');
}

function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  if (argv.includes('--version') || argv.includes('-v')) return { version: true };
  const [command, input, ...rest] = argv;
  if (!['build', 'serve'].includes(command)) throw new Error(`Unknown command: ${command || '(none)'}\n\n${HELP}`);
  if (!input || input.startsWith('-')) throw new Error(`Missing OpenAPI input.\n\n${HELP}`);

  const options = { command, input, out: 'flexdoc-dist', host: '127.0.0.1', port: 4174, basePath: '/', title: undefined, force: false, watch: false };
  const booleanFlags = new Set(['--force', '--watch']);
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (booleanFlags.has(flag)) { options[flag.slice(2)] = true; continue; }
    const value = rest[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--out') options.out = value;
    else if (flag === '--host') options.host = value;
    else if (flag === '--port') options.port = Number(value);
    else if (flag === '--base-path') options.basePath = value;
    else if (flag === '--title') options.title = value;
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error(`Invalid port: ${options.port}`);
  options.basePath = normalizeBasePath(options.basePath);
  return options;
}

async function parseData(text, source) {
  try {
    const sourcePath = source.startsWith('file:') ? fileURLToPath(source) : source;
    return extname(sourcePath).toLowerCase() === '.json' ? JSON.parse(text) : yaml.load(text);
  } catch (error) {
    throw new Error(`Invalid JSON/YAML document at ${source}: ${error instanceof Error ? error.message : error}`);
  }
}

function validateOpenApi(document, source) {
  if (!document || typeof document !== 'object' || !document.openapi || !document.info || !document.paths) {
    throw new Error(`Invalid OpenAPI document at ${source}: expected openapi, info, and paths`);
  }
  return document;
}

async function readSource(source, parentUri, requireOpenApi = false) {
  let text;
  let uri;
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Failed to load ${source}: HTTP ${response.status}`);
    text = await response.text();
    uri = response.url;
  } else if (source.startsWith('file:')) {
    const absolute = fileURLToPath(source);
    text = await readFile(absolute, 'utf8');
    uri = pathToFileURL(absolute).toString();
  } else if (parentUri?.startsWith('http')) {
    return readSource(new URL(source, parentUri).toString(), undefined, requireOpenApi);
  } else {
    const absolute = parentUri?.startsWith('file:') ? resolve(dirname(fileURLToPath(parentUri)), source) : resolve(source);
    text = await readFile(absolute, 'utf8');
    uri = pathToFileURL(absolute).toString();
  }
  const document = await parseData(text, uri);
  return { document: requireOpenApi ? validateOpenApi(document, uri) : document, uri };
}

async function loadBundledSpec(input, title) {
  const { document, uri } = await readSource(input, undefined, true);
  const bundled = await bundleExternalReferences(document, {
    baseUri: uri,
    load: async (referenceUri) => (await readSource(referenceUri)).document,
  });
  if (title) bundled.info.title = title;
  return bundled;
}

async function rendererFiles() {
  const explicit = process.env.FLEXDOC_CLIENT_DIR;
  if (explicit) return { js: resolve(explicit, 'dist/standalone/flexdoc.standalone.js'), css: resolve(explicit, 'dist/standalone/flexdoc.standalone.css') };
  return { js: fileURLToPath(import.meta.resolve('@prauga/flexdoc-client/standalone.js')), css: fileURLToPath(import.meta.resolve('@prauga/flexdoc-client/standalone.css')) };
}

function html({ title, basePath, rendererVersion, liveReload = false }) {
  const base = normalizeBasePath(basePath);
  const assetVersion = rendererVersion ? `?v=${rendererVersion}` : '';
  const safeTitle = String(title || 'FlexDoc').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const reload = liveReload ? `\n  <script>\n    new EventSource('${base}__flexdoc_reload').onmessage = function () { window.location.reload(); };\n  </script>` : '';
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width,initial-scale=1" />\n  <title>${safeTitle}</title>\n  <link rel="stylesheet" href="${base}flexdoc.css${assetVersion}" />\n</head>\n<body style="margin:0">\n  <div id="flexdoc-root"></div>\n  <script src="${base}flexdoc.js${assetVersion}"></script>\n  <script>\n    fetch('${base}openapi.json').then(function (response) {\n      if (!response.ok) throw new Error('Failed to load OpenAPI document: ' + response.status);\n      return response.json();\n    }).then(function (spec) {\n      return window.FlexDocStandalone.mountAsync(document.getElementById('flexdoc-root'), { spec: spec });\n    }).catch(function (error) {\n      document.getElementById('flexdoc-root').textContent = error.message;\n      console.error(error);\n    });\n  </script>${reload}\n</body>\n</html>\n`;
}

async function ensureEmptyOutput(outDir, force) {
  try {
    const marker = await readFile(join(outDir, '.flexdoc-generated'), 'utf8').catch(() => null);
    if (!force && marker === null) {
      const directory = await stat(outDir);
      if (directory.isDirectory()) throw new Error(`Output directory already exists: ${outDir}. Use --force to replace it.`);
    }
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

/**
 * Build a self-contained static FlexDoc site from an OpenAPI file or URL.
 *
 * @param {string} input Local JSON/YAML path or HTTP(S) URL containing the root OpenAPI document.
 * @param {object} [options] Static-site build options.
 * @param {string} [options.out='flexdoc-dist'] Output directory. Existing non-FlexDoc directories require `force`.
 * @param {string} [options.basePath='/'] URL base path used by generated asset/spec links.
 * @param {string} [options.title] Optional title overriding `spec.info.title` in the bundled document and page shell.
 * @param {boolean} [options.force=false] Replace an existing output directory even when it lacks FlexDoc's generated marker.
 * @param {boolean} [options.liveReload=false] Include the CLI live-reload EventSource script in generated HTML.
 * @returns {Promise<{outDir: string, spec: object}>} Absolute output directory and bundled OpenAPI document.
 */
export async function buildSite(input, options = {}) {
  const outDir = resolve(options.out || 'flexdoc-dist');
  await ensureEmptyOutput(outDir, Boolean(options.force));
  const spec = await loadBundledSpec(input, options.title);
  const renderer = await rendererFiles();
  await Promise.all([access(renderer.js), access(renderer.css)]);
  const [rendererJavaScript, rendererCss] = await Promise.all([
    readFile(renderer.js),
    readFile(renderer.css),
  ]);
  const rendererVersion = createHash('sha256')
    .update(rendererJavaScript)
    .update('\0')
    .update(rendererCss)
    .digest('hex')
    .slice(0, 16);
  await Promise.all([
    cp(renderer.js, join(outDir, 'flexdoc.js')),
    cp(renderer.css, join(outDir, 'flexdoc.css')),
    writeFile(join(outDir, 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`),
    writeFile(join(outDir, 'index.html'), html({ title: options.title || spec.info.title, basePath: options.basePath || '/', rendererVersion, liveReload: Boolean(options.liveReload) })),
    writeFile(join(outDir, '.flexdoc-generated'), 'Generated by @prauga/flexdoc-cli\n'),
  ]);
  return { outDir, spec };
}

function mimeType(pathname) {
  if (pathname.endsWith('.html')) return 'text/html; charset=utf-8';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function createStaticServer(root, { host, port, basePath }) {
  const normalizedBase = normalizeBasePath(basePath);
  const reloadClients = new Set();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
      if (!url.pathname.startsWith(normalizedBase)) { response.writeHead(404); response.end('Not found'); return; }
      let pathname = url.pathname.slice(normalizedBase.length);
      if (pathname === '__flexdoc_reload') {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        response.write(': connected\n\n');
        reloadClients.add(response);
        request.on('close', () => reloadClients.delete(response));
        return;
      }
      if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(root, pathname);
      if (file !== root && !file.startsWith(`${root}${sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': mimeType(file), 'cache-control': 'no-store' });
      response.end(body);
    } catch (error) {
      if (error?.code === 'ENOENT') { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(500); response.end('Internal server error');
    }
  });
  await new Promise((resolvePromise, reject) => { server.once('error', reject); server.listen(port, host, resolvePromise); });
  return {
    server,
    reload() { for (const client of reloadClients) client.write('data: reload\n\n'); },
    closeClients() { for (const client of reloadClients) client.end(); reloadClients.clear(); },
  };
}

/**
 * Build and serve a FlexDoc site locally, optionally rebuilding on source-file changes.
 *
 * @param {string} input Local JSON/YAML path or HTTP(S) URL containing the root OpenAPI document.
 * @param {object} [options] Local-server options plus all `buildSite` options except `out`.
 * @param {string} [options.host='127.0.0.1'] Interface/hostname passed to Node's HTTP server.
 * @param {number} [options.port=4174] Requested TCP port. Use `0` to let the OS choose an available port programmatically.
 * @param {string} [options.basePath='/'] URL base path at which the generated site is served.
 * @param {string} [options.title] Optional documentation title override.
 * @param {boolean} [options.watch=false] Watch a local root input file and rebuild/reload clients after changes.
 * @returns {Promise<{server: import('node:http').Server, close: () => Promise<void>, url: string}>} Server handle, async cleanup function, and resolved local URL.
 */
export async function serveSite(input, options = {}) {
  const host = options.host || '127.0.0.1';
  const requestedPort = options.port ?? 4174;
  const temporary = await mkdtemp(join(tmpdir(), 'flexdoc-'));
  const buildOptions = { ...options, out: temporary, force: true, liveReload: Boolean(options.watch) };
  let staticServer;
  const rebuild = async () => {
    try {
      await buildSite(input, buildOptions);
      staticServer?.reload();
      console.log(`FlexDoc rebuilt from ${input}`);
    } catch (error) { console.error(`FlexDoc rebuild failed: ${error instanceof Error ? error.message : error}`); }
  };
  await buildSite(input, buildOptions);
  staticServer = await createStaticServer(temporary, { ...options, host, port: requestedPort });
  const address = staticServer.server.address();
  const port = typeof address === 'object' && address ? address.port : requestedPort;
  const url = `http://${host}:${port}${normalizeBasePath(options.basePath)}`;
  console.log(`FlexDoc serving ${input} at ${url}`);

  let watcher;
  if (options.watch && !/^https?:\/\//i.test(input)) {
    watcher = watch(resolve(input), { persistent: true }, () => { void rebuild(); });
    console.log(`Watching ${resolve(input)} for changes`);
  }
  const close = async () => {
    watcher?.close();
    staticServer.closeClients();
    await new Promise((resolvePromise) => staticServer.server.close(resolvePromise));
    await rm(temporary, { recursive: true, force: true });
  };
  process.once('SIGINT', () => { void close().finally(() => process.exit(130)); });
  process.once('SIGTERM', () => { void close().finally(() => process.exit(143)); });
  return { server: staticServer.server, close, url };
}

/**
 * Parse FlexDoc CLI arguments and execute the selected build/serve command.
 * @param {string[]} argv Argument vector excluding the Node executable/script path.
 * @returns {Promise<void>} Resolves after a build completes or after the serve command has started its server.
 * @throws For invalid arguments, invalid OpenAPI input, build failures, or server startup failures.
 */
export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.help) { console.log(HELP); return; }
  if (options.version) {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version); return;
  }
  if (options.command === 'build') {
    const result = await buildSite(options.input, options);
    console.log(`FlexDoc static site written to ${relative(process.cwd(), result.outDir) || result.outDir}`);
    return;
  }
  await serveSite(options.input, options);
}
