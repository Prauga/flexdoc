import fs from 'node:fs';

const input = process.argv[2] || 'performance-results.json';
const results = JSON.parse(fs.readFileSync(input, 'utf8'));

// FlexDoc 3.1 baseline: Runtime Intelligence Contract Validation + the completed
// API Client surface, including the CodeMirror editor engine. These ceilings sit
// only a few percent above measured payloads so future growth stays explicit.
//
// Headroom policy: an accepted release candidate must retain at least 1 KiB of
// raw JavaScript headroom. If an intentional client change leaves less than that,
// either trim the bundle or raise the raw ceiling by the smallest whole-KiB step
// that restores >=1 KiB headroom. Compressed ceilings must not be raised merely
// to accommodate raw-only growth; gzip/brotli changes require their own review.
const budgets = {
  javascript: {
    // FlexDoc 3.3 host routing measured ~860,236 raw bytes before the final RC
    // preference plumbing. 842 KiB restores deliberate raw headroom while the
    // gzip (260 KiB) and brotli (220 KiB) ceilings remain unchanged.
    rawBytes: 842 * 1024,
    gzipBytes: 260 * 1024,
    brotliBytes: 220 * 1024,
  },
  css: {
    rawBytes: 43 * 1024,
    gzipBytes: 8.5 * 1024,
    brotliBytes: 7.2 * 1024,
  },
};

const failures = [];
for (const [asset, limits] of Object.entries(budgets)) {
  const actual = results.bundles?.[asset];
  if (!actual) {
    failures.push(`${asset}: missing bundle metrics`);
    continue;
  }

  for (const [metric, limit] of Object.entries(limits)) {
    const value = actual[metric];
    if (typeof value !== 'number') {
      failures.push(`${asset}.${metric}: missing metric`);
      continue;
    }
    if (value > limit) {
      failures.push(
        `${asset}.${metric}: ${(value / 1024).toFixed(1)} KiB exceeds ${(limit / 1024).toFixed(1)} KiB budget`,
      );
    }
  }
}

if (failures.length) {
  console.error('FlexDoc performance budget check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FlexDoc deterministic bundle budgets passed.');
for (const [asset, limits] of Object.entries(budgets)) {
  const actual = results.bundles[asset];
  console.log(
    `${asset}: raw ${(actual.rawBytes / 1024).toFixed(1)}/${(limits.rawBytes / 1024).toFixed(1)} KiB, ` +
      `gzip ${(actual.gzipBytes / 1024).toFixed(1)}/${(limits.gzipBytes / 1024).toFixed(1)} KiB, ` +
      `brotli ${(actual.brotliBytes / 1024).toFixed(1)}/${(limits.brotliBytes / 1024).toFixed(1)} KiB`,
  );
}
