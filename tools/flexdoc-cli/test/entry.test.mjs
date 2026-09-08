import assert from 'node:assert/strict';
import test from 'node:test';
import { runFlexDocCli } from '../src/entry.js';

test('dispatches run --help to the Runner-specific help surface', async () => {
  const output = [];
  const originalLog = console.log;
  console.log = (...values) => output.push(values.join(' '));
  try {
    const exitCode = await runFlexDocCli(['run', '--help']);
    assert.equal(exitCode, 0);
  } finally {
    console.log = originalLog;
  }

  const text = output.join('\n');
  assert.match(text, /FlexDoc headless Runner/);
  assert.match(text, /--report <file>/);
  assert.match(text, /Direct API requests never receive/);
});
