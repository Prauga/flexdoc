import fs from 'node:fs';

const sourcePath = process.argv[2] || 'packages/client/src/utils/api-client-workspace.ts';
const policyPath = process.argv[3] || 'scripts/performance/performance-policy.json';

const source = fs.readFileSync(sourcePath, 'utf8');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

if (policy.schemaVersion !== 1 || !policy.clientWorkspace?.history) {
  throw new Error(`Unexpected client-workspace policy shape in ${policyPath}`);
}
if (policy.clientWorkspace.governance?.increasePolicy !== 'trim-first') {
  throw new Error('Client workspace governance must retain the trim-first increase policy.');
}
if (policy.clientWorkspace.governance?.increaseRequiresEvidence !== true) {
  throw new Error('Client workspace limit increases must remain evidence-gated.');
}

/**
 * Read one numeric constant from the workspace source.
 *
 * Only simple literal and `n * m` forms are accepted so the governed ceiling is
 * compared against a value a reader can verify without executing the module.
 */
function readConstant(name) {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  if (!match) return undefined;
  const expression = match[1].trim();
  if (!/^[0-9*\s]+$/.test(expression)) {
    throw new Error(`${name} must be a literal byte/count expression so it can be governed statically.`);
  }
  return expression.split('*').reduce((total, part) => total * Number(part.trim()), 1);
}

const limits = policy.clientWorkspace.history;
const failures = [];

const entries = readConstant('HISTORY_LIMIT');
const responseBytes = readConstant('HISTORY_RESPONSE_BODY_LIMIT');
// Added by the history request-body cap. Governed as soon as it exists so the
// two caps cannot drift apart, and required once the cap has landed.
const requestBytes = readConstant('HISTORY_REQUEST_BODY_LIMIT');

if (entries === undefined) failures.push('HISTORY_LIMIT: not found in client workspace source');
if (responseBytes === undefined) failures.push('HISTORY_RESPONSE_BODY_LIMIT: not found in client workspace source');

const governed = [
  ['HISTORY_LIMIT', entries, limits.maxEntries, 'entries'],
  ['HISTORY_RESPONSE_BODY_LIMIT', responseBytes, limits.maxResponseBodyBytes, 'bytes'],
  ['HISTORY_REQUEST_BODY_LIMIT', requestBytes, limits.maxRequestBodyBytes, 'bytes'],
];

for (const [name, value, ceiling, unit] of governed) {
  if (value === undefined) continue;
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    failures.push(`${name}: invalid configured ceiling`);
    continue;
  }
  if (value > ceiling) failures.push(`${name}: ${value} ${unit} exceeds the governed ${ceiling} ${unit}`);
}

if (entries !== undefined && responseBytes !== undefined) {
  const worstCase = entries * (responseBytes + (requestBytes ?? 0));
  if (worstCase > limits.maxPersistedBytes) {
    failures.push(
      `worst-case persisted workspace ${(worstCase / 1024 / 1024).toFixed(1)} MiB exceeds the governed ${(limits.maxPersistedBytes / 1024 / 1024).toFixed(1)} MiB`,
    );
  }
}

if (failures.length) {
  console.error('FlexDoc client workspace limit check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nWorkspace limit increases are trim-first decisions. Raising a persisted ceiling requires evidence that the larger payload is worth the IndexedDB write cost.');
  process.exit(1);
}

const worstCase = (entries ?? 0) * ((responseBytes ?? 0) + (requestBytes ?? 0));
console.log(
  `FlexDoc client workspace limits passed: ${entries} entries x (${responseBytes} response` +
    `${requestBytes === undefined ? '' : ` + ${requestBytes} request`} bytes) = ` +
    `${(worstCase / 1024 / 1024).toFixed(1)}/${(limits.maxPersistedBytes / 1024 / 1024).toFixed(1)} MiB worst case`,
);
