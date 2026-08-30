import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { access, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const HELP = `FlexDoc CLI

Usage:
  flexdoc build <openapi> [--out <dir>] [--base-path <path>] [--title <title>] [--force]
  flexdoc serve <openapi> [--host <host>] [--port <port>] [--base-path <path>] [--title <title>] [--watch]

Input may be a local .json/.yaml/.yml file or an http(s) URL.
`;

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
    if (booleanFlags.has(flag)) {
      options[flag.slice(2)] = true;
      continue;
    }
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

async function parseDocument(text, source) {
  let document;
  try {
    document = extname(source).toLowerCase() === '.json' ? JSON.parse(text) : yaml.load(text);
  } catch (error) {
    throw new Error(`Invalid OpenAPI document at ${source}: ${error instanceof Error ? error.message : error}`);
  }
  if (!document || typeof document !== 'object' || !document.openapi || !document.info || !document.paths) {
    throw new Error(`Invalid OpenAPI document at ${source}: expected openapi, info, and paths`);
  }
  return document;
}

async function readSource(source, parentUri) {
  const isRemote = /^https?:\/\//i.test(source);
  if (isRemote) {
    const response = await fetch(source, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Failed to load ${source}: HTTP ${response.status}`);
    return { document: await parseDocument(await response.text(), source), uri: response.url };
  }
  if (parentUri?.startsWith('http')) {
    const url = new URL(source, parentUri).toString();
    return readSource(url);
  }
  const absolute = parentUri?.startsWith('file:')
    ? resolve(dirname(fileURLToPath(parentUri)), source)
    : resolve(source);
  return { document: await parseDocument(await readFile(absolute, 'utf8'), absolute), uri: pathToFileURL(absolute).toString() };
}

function decodePointerToken(token) {
  return decodeURIComponent(token).replace(/~1/g, '/').replace(/~0/g, '~');
}

function encodePointerToken(token) {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function splitRef(ref, fromUri) {
  if (ref.startsWith('#')) return { documentUri: fromUri, pointer: ref };
  const url = new URL(ref, fromUri);
  const pointer = url.hash || '#';
  url.hash = '';
  return { documentUri: url.toString(), pointer };
}

function externalPointer(documentUri, pointer) {
  const key = encodePointerToken(documentUri);
  if (pointer === '#' || pointer === '') return `#/x-flexdoc-external-documents/${key}`;
  if (!pointer.startsWith('#/')) throw new Error(`Unsupported JSON Pointer reference: ${pointer}`);
  return `#/x-flexdoc-external-documents/${key}/${pointer.slice(2)}`;
}

async function bundleReferences(rootDocument, rootUri) {
  const root = JSON.parse(JSON.stringify(rootDocument));
  const externalDocuments = {};
  const loading = new Map();
  const visited = new Set();

  async function getDocument(uri) {
    if (uri === rootUri) return root;
    if (externalDocuments[uri]) return externalDocuments[uri];
    if (!loading.has(uri)) {
      loading.set(uri, readSource(uri).then(({ document }) => JSON.parse(JSON.stringify(document))));
    }
    const document = await loading.get(uri);
    externalDocuments[uri] = document;
    return document;
  }

  async function rewriteDocument(document, documentUri) {
    if (visited.has(documentUri)) return;
    visited.add(documentUri);

    async function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) await walk(item);
        return;
      }
      if (typeof node.$ref === 'string') {
        const target = splitRef(node.$ref, documentUri);
        if (target.documentUri === rootUri) {
          node.$ref = target.pointer;
        } else if (target.documentUri !== documentUri) {
          const targetDocument = await getDocument(target.documentUri);
          node.$ref = externalPointer(target.documentUri, target.pointer);
          await rewriteDocument(targetDocument, target.documentUri);
        } else if (documentUri !== rootUri) {
          node.$ref = externalPointer(documentUri, target.pointer);
        }
      }
      for (const [key, value] of Object.entries(node)) if (key !== '$ref') await walk(value);
    }

    await walk(document);
  }

  await rewriteDocument(root, rootUri);
  if (Object.keys(externalDocuments).length) root['x-flexdoc-external-documents'] = externalDocuments;
  return root;
}

async function loadBundledSpec(input, title) {
  const { document, uri } = await readSource(input);
  const bundled = await bundleReferences(document, uri);
  if (title) bundled.info.title = title;
  return bundled;
}

async function rendererFiles() {
  const explicit = process.env.FLEXDOC_CLIENT_DIR;
  if (explicit) {
    return {
      js: resolve(explicit, 'dist/standalone/flexdoc.standalone.js'),
      css: resolve(explicit, 'dist/standalone/flexdoc.standalone.css'),
    };
  }
  return {
    js: fileURLToPath(await import.meta.resolve('@bluejeans/flexdoc-client/standalone.js')),
    css: fileURLToPath(await import.meta.resolve('@bluejeans/flexdoc-client/standalone.css')),
  };
}

function html({ title, basePath }) {
  const base = normalizeBasePath(basePath);
  const safeTitle = String(title || 'FlexDoc').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="${base}flexdoc.css" />
</head>
<body style="margin:0">
  <div id="flexdoc-root"></div>
  <script src="${base}flexdoc.js"></script>
  <script>
    fetch('${base}openapi.json').then(function (response) {
      if (!response.ok) throw new Error('Failed to load OpenAPI document: ' + response.status);
      return response.json();
    }).then(function (spec) {
      return window.FlexDocStandalone.mountAsync(document.getElementById('flexdoc-root'), { spec: spec });
    }).catch(function (error) {
      document.getElementById('flexdoc-root').textContent = error.message;
      console.error(error);
    });
  </script>
</body>
</html>\n`;
}

async function ensureEmptyOutput(outDir, force) {
  try {
    const entries = await readFile(join(outDir, '.flexdoc-generated'), 'utf8').catch(() => null);
    if (!force && entries === null) {
      const directory = await stat(outDir);
      if (directory.isDirectory()) throw new Error(`Output directory already exists: ${outDir}. Use --force to replace it.`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

export async function buildSite(input, options = {}) {
  const outDir = resolve(options.out || 'flexdoc-dist');
  await ensureEmptyOutput(outDir, Boolean(options.force));
  const spec = await loadBundledSpec(input, options.title);
  const renderer = await rendererFiles();
  await Promise.all([access(renderer.js), access(renderer.css)]);
  await Promise.all([
    cp(renderer.js, join(outDir, 'flexdoc.js')),
    cp(renderer.css, join(outDir, 'flexdoc.css')),
    writeFile(join(outDir, 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`),
    writeFile(join(outDir, 'index.html'), html({ title: options.title || spec.info.title, basePath: options.basePath || '/' })),
    writeFile(join(outDir, '.flexdoc-generated'), 'Generated by @bluejeans/flexdoc-cli\n'),
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
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
      if (!url.pathname.startsWith(normalizedBase)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      let pathname = url.pathname.slice(normalizedBase.length);
      if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(root, pathname);
      if (file !== root && !file.startsWith(`${root}${sep}`)) {
        response.writeHead(403); response.end('Forbidden'); return;
      }
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': mimeType(file), 'cache-control': 'no-store' });
      response.end(body);
    } catch (error) {
      if (error?.code === 'ENOENT') { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(500); response.end('Internal server error');
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolvePromise);
  });
  return server;
}

export async function serveSite(input, options = {}) {
  const temporary = resolve(process.cwd(), '.flexdoc-serve');
  const buildOptions = { ...options, out: temporary, force: true };
  const rebuild = async () => {
    try {
      await buildSite(input, buildOptions);
      console.log(`FlexDoc rebuilt from ${input}`);
    } catch (error) {
      console.error(`FlexDoc rebuild failed: ${error instanceof Error ? error.message : error}`);
    }
  };
  await buildSite(input, buildOptions);
  const server = await createStaticServer(temporary, options);
  const url = `http://${options.host}:${options.port}${normalizeBasePath(options.basePath)}`;
  console.log(`FlexDoc serving ${input} at ${url}`);

  let watcher;
  if (options.watch && !/^https?:\/\//i.test(input)) {
    watcher = watch(resolve(input), { persistent: true }, () => { void rebuild(); });
    console.log(`Watching ${resolve(input)} for changes`);
  }
  const close = async () => {
    watcher?.close();
    await new Promise((resolvePromise) => server.close(resolvePromise));
    await rm(temporary, { recursive: true, force: true });
  };
  process.once('SIGINT', () => { void close().finally(() => process.exit(130)); });
  process.once('SIGTERM', () => { void close().finally(() => process.exit(143)); });
  return { server, close, url };
}

export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.help) { console.log(HELP); return; }
  if (options.version) {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    return;
  }
  if (options.command === 'build') {
    const result = await buildSite(options.input, options);
    console.log(`FlexDoc static site written to ${relative(process.cwd(), result.outDir) || result.outDir}`);
    return;
  }
  await serveSite(options.input, options);
}
