const VALIDATION_CODES = new Set([
  'runtime.operation-undocumented',
  'runtime.operation-unobserved',
  'runtime.method-mismatch',
  'runtime.duplicate-operation',
]);
const VALIDATION_SEVERITIES = new Set(['error', 'warning', 'info']);
const VALIDATION_STATUSES = new Set(['pass', 'warn', 'fail', 'partial']);

export const VALIDATE_HELP = `FlexDoc runtime contract validation\n\nUsage:\n  flexdoc validate <runtime-intelligence-url> [--json]\n\nThe URL must point to the installed backend's <docsPath>/__flexdoc/runtime endpoint.\nExit code 1 is returned when the backend reports validation status \"fail\" or the snapshot cannot be consumed.\n`;

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

export async function fetchRuntimeContractValidation(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(runtimeUrl(url), {
    method: 'GET',
    headers: { accept: 'application/json' },
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

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

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

export async function runValidationCli(argv, options = {}) {
  const log = options.log || console.log;
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    log(VALIDATE_HELP);
    return 0;
  }

  const [url, ...rest] = argv;
  if (!url || url.startsWith('-')) throw new Error(`Missing Runtime Intelligence URL.\n\n${VALIDATE_HELP}`);
  let json = false;
  for (const flag of rest) {
    if (flag === '--json') json = true;
    else throw new Error(`Unknown validate option: ${flag}\n\n${VALIDATE_HELP}`);
  }

  const result = await fetchRuntimeContractValidation(url, options);
  log(json ? JSON.stringify(result, null, 2) : formatContractValidationResult(result));
  return result.status === 'fail' ? 1 : 0;
}
