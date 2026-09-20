import fs from 'node:fs';

const input = process.argv[2] || 'performance-results.json';
const policyPath = process.argv[3] || 'scripts/performance/performance-policy.json';
const results = JSON.parse(fs.readFileSync(input, 'utf8'));
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

if (policy.schemaVersion !== 1 || !policy.bundles?.assets || typeof policy.bundles.assets !== 'object') {
  throw new Error(`Unexpected performance policy shape in ${policyPath}`);
}
if (policy.bundles.governance?.increasePolicy !== 'trim-first') {
  throw new Error('Bundle governance must retain the trim-first budget-increase policy.');
}
if (policy.bundles.governance?.compressedBudgetIncreaseRequiresEvidence !== true) {
  throw new Error('Compressed bundle budget increases must remain evidence-gated.');
}

const budgets = policy.bundles.assets;
const budgetMetrics = ['rawBytes', 'gzipBytes', 'brotliBytes'];
const failures = [];

for (const [asset, limits] of Object.entries(budgets)) {
  const actual = results.bundles?.[asset];
  if (!actual) {
    failures.push(`${asset}: missing bundle metrics`);
    continue;
  }

  for (const metric of budgetMetrics) {
    const limit = Number(limits[metric]);
    const value = Number(actual[metric]);
    if (!Number.isFinite(limit) || limit <= 0) {
      failures.push(`${asset}.${metric}: invalid configured budget`);
      continue;
    }
    if (!Number.isFinite(value)) {
      failures.push(`${asset}.${metric}: missing metric`);
      continue;
    }
    if (value > limit) {
      failures.push(
        `${asset}.${metric}: ${(value / 1024).toFixed(1)} KiB exceeds ${(limit / 1024).toFixed(1)} KiB budget`,
      );
    }
  }

  const minimumRawHeadroomBytes = Number(limits.minimumRawHeadroomBytes ?? 0);
  const rawHeadroomBytes = Number(limits.rawBytes) - Number(actual.rawBytes);
  if (!Number.isFinite(minimumRawHeadroomBytes) || minimumRawHeadroomBytes < 0) {
    failures.push(`${asset}.minimumRawHeadroomBytes: invalid configured headroom`);
  } else if (Number.isFinite(rawHeadroomBytes) && rawHeadroomBytes < minimumRawHeadroomBytes) {
    failures.push(
      `${asset}.rawBytes: ${(rawHeadroomBytes / 1024).toFixed(2)} KiB headroom is below the required ${(minimumRawHeadroomBytes / 1024).toFixed(2)} KiB`,
    );
  }
}

if (failures.length) {
  console.error('FlexDoc performance budget check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nBudget increases are trim-first decisions. If growth is intentional, document the feature cost; compressed ceilings require independent evidence.');
  process.exit(1);
}

console.log('FlexDoc deterministic bundle budgets passed.');
for (const [asset, limits] of Object.entries(budgets)) {
  const actual = results.bundles[asset];
  const rawHeadroomBytes = limits.rawBytes - actual.rawBytes;
  console.log(
    `${asset}: raw ${(actual.rawBytes / 1024).toFixed(1)}/${(limits.rawBytes / 1024).toFixed(1)} KiB ` +
      `(headroom ${(rawHeadroomBytes / 1024).toFixed(2)} KiB; minimum ${((limits.minimumRawHeadroomBytes ?? 0) / 1024).toFixed(2)} KiB), ` +
      `gzip ${(actual.gzipBytes / 1024).toFixed(1)}/${(limits.gzipBytes / 1024).toFixed(1)} KiB, ` +
      `brotli ${(actual.brotliBytes / 1024).toFixed(1)}/${(limits.brotliBytes / 1024).toFixed(1)} KiB`,
  );
}
