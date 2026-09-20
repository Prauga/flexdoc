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

const governed = [
  ['HISTORY_LIMIT', limits.maxEntries, 'entries'],
  ['HISTORY_RESPONSE_BODY_LIMIT', limits.maxResponseBodyBytes, 'bytes'],
  ['HISTORY_REQUEST_BODY_LIMIT', limits.maxRequestBodyBytes, 'bytes'],
];

// Every governed constant is mandatory. Treating a missing one as "nothing to
// check" would let deleting a cap silently pass the gate it exists to enforce.
const values = new Map();
for (const [name, ceiling, unit] of governed) {
  const value = readConstant(name);
  if (value === undefined) {
    failures.push(`${name}: not found in ${sourcePath}`);
    continue;
  }
  values.set(name, value);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    failures.push(`${name}: invalid configured ceiling`);
    continue;
  }
  if (value > ceiling) failures.push(`${name}: ${value} ${unit} exceeds the governed ${ceiling} ${unit}`);
}

const entries = values.get('HISTORY_LIMIT');
const responseBytes = values.get('HISTORY_RESPONSE_BODY_LIMIT');
const requestBytes = values.get('HISTORY_REQUEST_BODY_LIMIT');
const worstCase = entries === undefined || responseBytes === undefined || requestBytes === undefined
  ? undefined
  : entries * (responseBytes + requestBytes);

if (worstCase !== undefined && worstCase > limits.maxPersistedBytes) {
  failures.push(
    `worst-case persisted workspace ${(worstCase / 1024 / 1024).toFixed(1)} MiB exceeds the governed ${(limits.maxPersistedBytes / 1024 / 1024).toFixed(1)} MiB`,
  );
}

if (failures.length) {
  console.error('FlexDoc client workspace limit check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nWorkspace limit increases are trim-first decisions. Raising a persisted ceiling requires evidence that the larger payload is worth the IndexedDB write cost.');
  process.exit(1);
}

console.log(
  `FlexDoc client workspace limits passed: ${entries} entries x (${responseBytes} response + ${requestBytes} request bytes) = ` +
    `${(worstCase / 1024 / 1024).toFixed(1)}/${(limits.maxPersistedBytes / 1024 / 1024).toFixed(1)} MiB worst case`,
);
