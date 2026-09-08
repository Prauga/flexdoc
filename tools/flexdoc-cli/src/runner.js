import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseApiClientRunnerArtifact,
  runApiClientCollection,
} from '@prauga/flexdoc-client';

export const RUNNER_REPORT_KIND = 'flexdoc-run-report';
export const RUNNER_REPORT_VERSION = 1;

export const RUN_HELP = `FlexDoc headless Runner\n\nUsage:\n  flexdoc run <artifact.json> [options]\n\nOptions:\n  --host <docs-url>          Load advertised host execution from a FlexDoc docs page\n  --header <name:value>      Add a docs-host request header; repeat for multiple headers\n  --bearer <token>           Authenticate to the docs/execute host with a bearer token\n  --basic <user:password>    Authenticate to the docs/execute host with HTTP Basic\n  --stop-on-failure          Stop after the first failed request\n  --json                     Print the machine-readable run report as JSON\n  --report <file>            Also write the JSON run report to a file\n\nThe artifact uses the canonical FlexDoc workspace request/script model. Scripts run in this CLI process.\nDirect API requests never receive --header/--bearer/--basic values; those flags authenticate only the FlexDoc docs/execute host.\n`;

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requiredOptionValue(rest, index, flag) {
  const value = rest[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}.\n\n${RUN_HELP}`);
  return value;
}

function setHeader(headers, name, value) {
  const headerName = String(name || '').trim();
  const headerValue = String(value ?? '').trim();
  if (!headerName || /[\r\n:]/.test(headerName)) throw new Error(`Invalid HTTP header name: ${name}`);
  if (/\r|\n/.test(headerValue)) throw new Error(`Invalid HTTP header value for ${headerName}`);
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === headerName.toLowerCase()) delete headers[existing];
  }
  headers[headerName] = headerValue;
}

function parseHeaderArgument(value) {
  const separator = value.indexOf(':');
  if (separator <= 0) throw new Error(`Invalid --header value: ${value}. Expected name:value.`);
  const parsed = {};
  setHeader(parsed, value.slice(0, separator), value.slice(separator + 1));
  return Object.entries(parsed)[0];
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === name.toLowerCase());
}

function docsAuthHeaders(options) {
  const headers = {};
  for (const [name, value] of Object.entries(options.headers || {})) setHeader(headers, name, value);
  if (options.bearer !== undefined && options.basic !== undefined) throw new Error('Use only one of --bearer or --basic.');
  if ((options.bearer !== undefined || options.basic !== undefined) && hasHeader(headers, 'authorization')) {
    throw new Error('Do not combine --bearer/--basic with an explicit Authorization header.');
  }
  if (options.bearer !== undefined) {
    const token = String(options.bearer).trim();
    if (!token) throw new Error('Bearer token must not be empty.');
    setHeader(headers, 'Authorization', `Bearer ${token}`);
  }
  if (options.basic !== undefined) {
    const credentials = String(options.basic);
    const separator = credentials.indexOf(':');
    if (separator <= 0) throw new Error('Basic credentials must use user:password format.');
    setHeader(headers, 'Authorization', `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`);
  }
  return headers;
}

function normalizeDocsUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid FlexDoc docs URL: ${value}`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`FlexDoc docs URL must use http or https: ${value}`);
  return url.toString();
}

function parseHostExecutionAdvertisement(html, pageUrl) {
  const assignment = /window\.__FLEXDOC_OPTIONS__\s*=\s*/.exec(html);
  if (!assignment) return undefined;
  const valueStart = assignment.index + assignment[0].length;
  const scriptEnd = html.indexOf('</script>', valueStart);
  const searchEnd = scriptEnd >= 0 ? scriptEnd : html.length;

  let options;
  let assignmentEnd = html.indexOf(';', valueStart);
  while (assignmentEnd >= 0 && assignmentEnd < searchEnd) {
    try {
      options = JSON.parse(html.slice(valueStart, assignmentEnd));
      break;
    } catch {
      assignmentEnd = html.indexOf(';', assignmentEnd + 1);
    }
  }
  if (options === undefined) throw new Error('FlexDoc docs page contains an unreadable public-options advertisement.');

  const hostExecution = isRecord(options?.tryIt) ? options.tryIt.hostExecution : undefined;
  if (!isRecord(hostExecution)) return undefined;
  if (typeof hostExecution.available !== 'boolean' || typeof hostExecution.endpoint !== 'string' || !Array.isArray(hostExecution.capabilities)) {
    throw new Error('FlexDoc docs page contains an invalid host-execution advertisement.');
  }

  let page;
  let endpoint;
  try {
    page = new URL(pageUrl);
    endpoint = new URL(hostExecution.endpoint, page);
  } catch {
    throw new Error('FlexDoc docs page contains an invalid host-execution endpoint.');
  }
  if (endpoint.origin !== page.origin) {
    throw new Error('FlexDoc host-execution endpoint must remain on the same origin as the documentation page.');
  }

  return {
    available: hostExecution.available,
    endpoint: endpoint.toString(),
    capabilities: hostExecution.capabilities.filter((capability) => typeof capability === 'string'),
    ...(Array.isArray(hostExecution.certificates) ? { certificates: hostExecution.certificates } : {}),
  };
}
function redirectLocation(response) {
  return response.headers && typeof response.headers.get === 'function'
    ? response.headers.get('location')
    : undefined;
}

/** Load the existing renderer host-execution advertisement from a FlexDoc docs page. */
export async function fetchHostExecutionAdvertisement(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const headers = new Headers({ accept: 'text/html', ...(options.headers || {}) });
  const initialUrl = new URL(normalizeDocsUrl(url));
  const trustedOrigin = initialUrl.origin;
  let currentUrl = initialUrl.toString();

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetchImpl(currentUrl, { method: 'GET', headers, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      if (redirects === 5) throw new Error('FlexDoc docs host exceeded the 5-redirect limit.');
      const location = redirectLocation(response);
      if (!location) throw new Error(`FlexDoc docs host redirected without a Location header: HTTP ${response.status}`);
      let nextUrl;
      try { nextUrl = new URL(location, currentUrl); } catch { throw new Error(`FlexDoc docs host returned an invalid redirect location: ${location}`); }
      if (!['http:', 'https:'].includes(nextUrl.protocol) || nextUrl.origin !== trustedOrigin) {
        throw new Error(`FlexDoc docs host redirect must remain on the original origin ${trustedOrigin}.`);
      }
      currentUrl = nextUrl.toString();
      continue;
    }
    if (!response.ok) throw new Error(`Failed to load FlexDoc docs host: HTTP ${response.status}`);
    const html = await response.text();
    return parseHostExecutionAdvertisement(html, response.url || currentUrl);
  }
  throw new Error('FlexDoc docs host exceeded the redirect limit.');
}

function parseRunnerArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const [artifactPath, ...rest] = argv;
  if (!artifactPath || artifactPath.startsWith('-')) throw new Error(`Missing Runner artifact.\n\n${RUN_HELP}`);

  const options = {
    artifactPath,
    host: undefined,
    headers: {},
    bearer: undefined,
    basic: undefined,
    stopOnFailure: false,
    json: false,
    report: undefined,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--stop-on-failure') { options.stopOnFailure = true; continue; }
    if (flag === '--json') { options.json = true; continue; }
    if (flag === '--host') { options.host = requiredOptionValue(rest, index, flag); index += 1; continue; }
    if (flag === '--report') { options.report = requiredOptionValue(rest, index, flag); index += 1; continue; }
    if (flag === '--bearer') { options.bearer = requiredOptionValue(rest, index, flag); index += 1; continue; }
    if (flag === '--basic') { options.basic = requiredOptionValue(rest, index, flag); index += 1; continue; }
    if (flag === '--header') {
      const [name, value] = parseHeaderArgument(requiredOptionValue(rest, index, flag));
      setHeader(options.headers, name, value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown run option: ${flag}\n\n${RUN_HELP}`);
  }
  if (!options.host && (Object.keys(options.headers).length > 0 || options.bearer !== undefined || options.basic !== undefined)) {
    throw new Error('--header, --bearer, and --basic require --host because they authenticate the FlexDoc docs/execute host.');
  }
  return options;
}

async function loadArtifact(path) {
  let parsed;
  try { parsed = JSON.parse(await readFile(resolve(path), 'utf8')); } catch (error) {
    throw new Error(`Unable to read Runner artifact ${path}: ${error instanceof Error ? error.message : error}`);
  }
  return parseApiClientRunnerArtifact(parsed);
}

function sameUrl(left, right) {
  try { return new URL(String(left)).toString() === new URL(String(right)).toString(); } catch { return false; }
}

function runnerFetcher(fetchImpl, hostExecution, authHeaders, activeRequest, executors) {
  return async (input, init = {}) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init.headers || {});
    const hostRequest = !!hostExecution
      && sameUrl(rawUrl, hostExecution.endpoint)
      && headers.get('X-FlexDoc-Execute') === '1';
    if (activeRequest.id) executors.set(activeRequest.id, hostRequest ? 'host' : 'direct');
    if (!hostRequest) return fetchImpl(input, init);

    for (const [name, value] of Object.entries(authHeaders)) headers.set(name, value);
    return fetchImpl(input, { ...init, headers, redirect: 'manual' });
  };
}

function reportItem(item, executor, runId, index) {
  const result = item.outcome.result;
  return {
    itemId: `${runId}:${index + 1}`,
    requestId: item.requestId,
    requestName: item.requestName,
    collectionId: item.collectionId,
    ...(item.folderId ? { folderId: item.folderId } : {}),
    executor: executor || null,
    passed: item.passed,
    cancelled: item.cancelled,
    ...(item.outcome.response ? {
      status: item.outcome.response.status,
      statusText: item.outcome.response.statusText,
      responseTime: item.outcome.response.responseTime,
    } : result ? {
      ...(result.status !== undefined ? { status: result.status } : {}),
      ...(result.statusText !== undefined ? { statusText: result.statusText } : {}),
      ...(result.responseTime !== undefined ? { responseTime: result.responseTime } : {}),
    } : {}),
    tests: item.outcome.scriptTests.map((test) => ({ ...test })),
    ...(item.outcome.error || result?.error ? { error: item.outcome.error || result?.error } : {}),
    ...(item.outcome.scriptError || result?.scriptError ? { scriptError: item.outcome.scriptError || result?.scriptError } : {}),
  };
}

/** Convert the canonical collection-run result into the stable 3.2 machine report. */
export function createRunnerReport(artifact, result, executors, startedAt, completedAt) {
  const successful = result.failed === 0 && result.cancelled === 0 && result.completed === result.total;
  const interrupted = result.stopped && result.failed === 0 && result.completed < result.total;
  return {
    kind: RUNNER_REPORT_KIND,
    version: RUNNER_REPORT_VERSION,
    status: successful ? 'pass' : (result.cancelled > 0 || interrupted) ? 'cancelled' : 'fail',
    artifact: {
      kind: artifact.kind,
      version: artifact.version,
      exportedAt: artifact.exportedAt,
      scope: { ...artifact.scope },
    },
    runId: result.runId,
    runName: result.runName,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    total: result.total,
    completed: result.completed,
    passed: result.passed,
    failed: result.failed,
    cancelled: result.cancelled,
    stopped: result.stopped,
    items: result.items.map((item, index) => reportItem(item, executors.get(item.requestId), result.runId, index)),
  };
}

/** Human-readable summary for local CLI usage; JSON remains the CI/report contract. */
export function formatRunnerReport(report) {
  const lines = [
    `FlexDoc Runner: ${report.status.toUpperCase()} · ${report.runName}`,
    `${report.passed} passed, ${report.failed} failed, ${report.cancelled} cancelled · ${report.completed}/${report.total} completed`,
  ];
  for (const item of report.items) {
    const transport = item.executor || 'not executed';
    const status = item.status !== undefined ? ` · HTTP ${item.status}` : '';
    const timing = item.responseTime !== undefined ? ` · ${Math.round(item.responseTime)} ms` : '';
    lines.push(`${item.passed ? 'PASS' : item.cancelled ? 'CANCEL' : 'FAIL'} ${item.requestName} · ${transport}${status}${timing}`);
    if (item.error) lines.push(`  ${item.error}`);
    if (item.scriptError) lines.push(`  ${item.scriptError}`);
    for (const test of item.tests) lines.push(`  ${test.passed ? '✓' : '✗'} ${test.name}${test.error ? ` — ${test.error}` : ''}`);
  }
  return lines.join('\n');
}

/** Execute `flexdoc run` against a portable workspace artifact. */
export async function runRunnerCli(argv, options = {}) {
  const log = options.log || console.log;
  const parsed = parseRunnerArgs(argv);
  if (parsed.help) { log(RUN_HELP); return 0; }

  const artifact = await loadArtifact(parsed.artifactPath);
  const fetchImpl = options.fetchImpl || fetch;
  const authHeaders = docsAuthHeaders(parsed);
  const hostExecution = parsed.host
    ? await fetchHostExecutionAdvertisement(parsed.host, { fetchImpl, headers: authHeaders })
    : undefined;
  if (parsed.host && !hostExecution) {
    throw new Error('The --host documentation page did not advertise a valid FlexDoc tryIt.hostExecution capability.');
  }
  const activeRequest = { id: undefined };
  const executors = new Map();
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  const onSigint = () => controller.abort(new Error('Runner interrupted'));
  const onSigterm = () => controller.abort(new Error('Runner terminated'));
  if (!options.disableProcessSignals) {
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
  }

  const startedAt = new Date().toISOString();
  let result;
  try {
    const scope = artifact.scope;
    result = await runApiClientCollection({
      workspace: artifact.workspace,
      collectionId: scope.collectionId,
      ...(scope.type === 'folder' ? { folderId: scope.folderId } : {}),
      stopOnFailure: parsed.stopOnFailure,
      signal: controller.signal,
      hostExecution,
      fetcher: runnerFetcher(fetchImpl, hostExecution, authHeaders, activeRequest, executors),
      onRequestStart: (request) => { activeRequest.id = request.id; },
      onRequestComplete: () => { activeRequest.id = undefined; },
    });
  } finally {
    externalSignal?.removeEventListener('abort', abortFromExternal);
    if (!options.disableProcessSignals) {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
    }
  }

  const report = createRunnerReport(artifact, result, executors, startedAt, new Date().toISOString());
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (parsed.report) await writeFile(resolve(parsed.report), json, 'utf8');
  log(parsed.json ? json.trimEnd() : formatRunnerReport(report));
  if (controller.signal.aborted) return 130;
  return report.status === 'pass' ? 0 : 1;
}
