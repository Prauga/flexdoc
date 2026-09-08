import { Buffer } from 'node:buffer';

const VALIDATION_CODES = new Set([
  'runtime.operation-undocumented',
  'runtime.operation-unobserved',
  'runtime.method-mismatch',
  'runtime.duplicate-operation',
]);
const VALIDATION_SEVERITIES = new Set(['error', 'warning', 'info']);
const VALIDATION_STATUSES = new Set(['pass', 'warn', 'fail', 'partial']);
const FAIL_ON_LEVELS = new Set(['error', 'warning', 'info']);

export const VALIDATE_HELP = `FlexDoc runtime contract validation\n\nUsage:\n  flexdoc validate <runtime-intelligence-url> [options]\n\nOptions:\n  --json                     Print the backend validation object as JSON\n  --header <name:value>      Add a request header; repeat for multiple headers\n  --bearer <token>           Send Authorization: Bearer <token>\n  --basic <user:password>    Send HTTP Basic authorization\n  --fail-on <level>          Exit 1 on error, warning, or info findings (default: error)\n\nThe URL must point to a Node FlexDoc 3.1 <docsPath>/__flexdoc/runtime endpoint that emits a validation object.\nBy default, exit code 1 is returned only when the backend reports validation status \"fail\" or the snapshot cannot be consumed.\n`;

function invalidValidation(detail) {
  throw new Error(`Invalid Runtime Intelligence validation payload${detail ? `: ${detail}` : '.'}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record, key) {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') invalidValidation(`expected non-empty ${key}`);
  return value;
}

function optionalString(record, key) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') invalidValidation(`expected non-empty ${key}`);
  return value;
}

function optionalStringOrStrings(record, key) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.trim() !== '')) {
    return [...value];
  }
  invalidValidation(`expected ${key} to be a non-empty string or string array`);
}

function count(record, key) {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) invalidValidation(`expected non-negative integer ${key}`);
  return value;
}

function parseFinding(value) {
  if (!isRecord(value) || !isRecord(value.location)) invalidValidation('finding must contain an operation location');
  const code = requiredString(value, 'code');
  const severity = requiredString(value, 'severity');
  if (!VALIDATION_CODES.has(code)) invalidValidation(`unsupported finding code ${code}`);
  if (!VALIDATION_SEVERITIES.has(severity)) invalidValidation(`unsupported finding severity ${severity}`);
  if (value.location.kind !== 'operation') invalidValidation('finding location kind must be operation');

  const finding = {
    id: requiredString(value, 'id'),
    code,
    severity,
    location: {
      kind: 'operation',
      path: requiredString(value.location, 'path'),
    },
    message: requiredString(value, 'message'),
  };
  const method = optionalString(value.location, 'method');
  if (method) finding.location.method = method;
  const expected = optionalStringOrStrings(value, 'expected');
  if (expected !== undefined) finding.expected = expected;
  const observed = optionalStringOrStrings(value, 'observed');
  if (observed !== undefined) finding.observed = observed;
  return finding;
}

/**
 * Parse and integrity-check a backend-produced FlexDoc 3.1 validation object.
 * @param {unknown} value Candidate validation value from a Runtime Intelligence snapshot.
 * @returns {{status:string,complete:boolean,findings:Array,summary:{total:number,errors:number,warnings:number,info:number}}} Validated result.
 * @throws When codes, severities, summary counts, or aggregate status are inconsistent.
 */
export function parseContractValidationResult(value) {
  if (!isRecord(value) || !isRecord(value.summary) || !Array.isArray(value.findings) || typeof value.complete !== 'boolean') {
    invalidValidation('expected status, complete, findings, and summary');
  }
  const status = requiredString(value, 'status');
  if (!VALIDATION_STATUSES.has(status)) invalidValidation(`unsupported status ${status}`);

  const findings = value.findings.map(parseFinding);
  const summary = {
    total: count(value.summary, 'total'),
    errors: count(value.summary, 'errors'),
    warnings: count(value.summary, 'warnings'),
    info: count(value.summary, 'info'),
  };
  const observedSummary = {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  };
  if (JSON.stringify(summary) !== JSON.stringify(observedSummary)) invalidValidation('summary does not match findings');

  const expectedStatus = summary.errors > 0
    ? 'fail'
    : summary.warnings > 0
      ? 'warn'
      : !value.complete
        ? 'partial'
        : 'pass';
  if (status !== expectedStatus) invalidValidation(`status ${status} is inconsistent with findings/completeness`);

  return { status, complete: value.complete, findings, summary };
}

function runtimeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid Runtime Intelligence URL: ${value}`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Runtime Intelligence URL must use http or https: ${value}`);
  return url.toString();
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
  const name = value.slice(0, separator);
  const headerValue = value.slice(separator + 1);
  const parsed = {};
  setHeader(parsed, name, headerValue);
  const [[parsedName, parsedValue]] = Object.entries(parsed);
  return [parsedName, parsedValue];
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === name.toLowerCase());
}

function requestHeaders(options) {
  const headers = { accept: 'application/json' };
  for (const [name, value] of Object.entries(options.headers || {})) setHeader(headers, name, value);

  if (options.bearer !== undefined && options.basic !== undefined) {
    throw new Error('Use only one of --bearer or --basic.');
  }
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

/**
 * Fetch the backend-produced FlexDoc 3.1 validation object from Runtime Intelligence.
 * @param {string} url Absolute HTTP(S) Runtime Intelligence endpoint URL.
 * @param {object} [options] Fetch/authentication options.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation used for tests or custom runtimes.
 * @param {Record<string,string>} [options.headers] Additional request headers.
 * @param {string} [options.bearer] Bearer token sent through the Authorization header.
 * @param {string} [options.basic] Basic credentials in `user:password` form.
 * @returns {Promise<object>} Strictly validated backend Contract Validation result.
 */
export async function fetchRuntimeContractValidation(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(runtimeUrl(url), {
    method: 'GET',
    headers: requestHeaders(options),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Failed to load Runtime Intelligence: HTTP ${response.status}`);

  let snapshot;
  try { snapshot = await response.json(); } catch (error) {
    throw new Error(`Runtime Intelligence returned invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!isRecord(snapshot) || snapshot.validation === undefined) {
    throw new Error('Runtime Intelligence snapshot does not include FlexDoc 3.1 contract validation.');
  }
  return parseContractValidationResult(snapshot.validation);
}

function displayValue(value) {
  return Array.isArray(value) ? value.join(', ') : value;
}

function countLabel(countValue, singular) {
  return `${countValue} ${singular}${countValue === 1 ? '' : 's'}`;
}

/**
 * Format a Contract Validation result for human-readable CI logs.
 * @param {object} result Parsed validation result.
 * @returns {string} Multi-line status and finding output.
 */
export function formatContractValidationResult(result) {
  const lines = [
    `FlexDoc contract validation: ${result.status.toUpperCase()}`,
    `${countLabel(result.summary.errors, 'error')}, ${countLabel(result.summary.warnings, 'warning')}, ${countLabel(result.summary.info, 'info')} · discovery ${result.complete ? 'complete' : 'partial'}`,
  ];
  for (const finding of result.findings) {
    const operation = `${finding.location.method ? `${finding.location.method} ` : ''}${finding.location.path}`;
    lines.push('', `[${finding.severity.toUpperCase()}] ${finding.code} · ${operation}`, finding.message);
    if (finding.expected !== undefined) lines.push(`Expected: ${displayValue(finding.expected)}`);
    if (finding.observed !== undefined) lines.push(`Observed: ${displayValue(finding.observed)}`);
  }
  return lines.join('\n');
}

function validationExitCode(result, failOn) {
  if (failOn === 'info') return result.summary.total > 0 ? 1 : 0;
  if (failOn === 'warning') return result.summary.errors > 0 || result.summary.warnings > 0 ? 1 : 0;
  return result.status === 'fail' ? 1 : 0;
}

function requiredOptionValue(rest, index, flag) {
  const value = rest[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}.\n\n${VALIDATE_HELP}`);
  return value;
}

/**
 * Execute the `flexdoc validate` command.
 * @param {string[]} argv Arguments after the `validate` command.
 * @param {object} [options] Test/programmatic overrides such as `fetchImpl` and `log`.
 * @returns {Promise<number>} Process exit code according to the selected fail policy.
 */
export async function runValidationCli(argv, options = {}) {
  const log = options.log || console.log;
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    log(VALIDATE_HELP);
    return 0;
  }

  const [url, ...rest] = argv;
  if (!url || url.startsWith('-')) throw new Error(`Missing Runtime Intelligence URL.\n\n${VALIDATE_HELP}`);
  let json = false;
  let bearer;
  let basic;
  let failOn = 'error';
  const headers = {};

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--json') {
      json = true;
      continue;
    }
    if (flag === '--header') {
      const value = requiredOptionValue(rest, index, flag);
      const [name, headerValue] = parseHeaderArgument(value);
      setHeader(headers, name, headerValue);
      index += 1;
      continue;
    }
    if (flag === '--bearer') {
      bearer = requiredOptionValue(rest, index, flag);
      index += 1;
      continue;
    }
    if (flag === '--basic') {
      basic = requiredOptionValue(rest, index, flag);
      index += 1;
      continue;
    }
    if (flag === '--fail-on') {
      failOn = requiredOptionValue(rest, index, flag);
      if (!FAIL_ON_LEVELS.has(failOn)) throw new Error(`Invalid --fail-on value: ${failOn}. Expected error, warning, or info.`);
      index += 1;
      continue;
    }
    throw new Error(`Unknown validate option: ${flag}\n\n${VALIDATE_HELP}`);
  }

  const result = await fetchRuntimeContractValidation(url, { ...options, headers, bearer, basic });
  log(json ? JSON.stringify(result, null, 2) : formatContractValidationResult(result));
  return validationExitCode(result, failOn);
}
