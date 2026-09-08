import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchRuntimeContractValidation,
  formatContractValidationResult,
  parseContractValidationResult,
  runValidationCli,
} from '../src/validation.js';

const warningFinding = {
  id: 'runtime.duplicate-operation:GET:/pets/{}',
  code: 'runtime.duplicate-operation',
  severity: 'warning',
  location: { kind: 'operation', method: 'GET', path: '/pets/{id}' },
  message: 'Runtime registers GET /pets/{id} twice.',
  expected: 'One runtime registration for this HTTP operation',
  observed: '2 runtime registrations',
};

const warningValidation = {
  status: 'warn',
  complete: true,
  findings: [warningFinding],
  summary: { total: 1, errors: 0, warnings: 1, info: 0 },
};

const failingValidation = {
  status: 'fail',
  complete: true,
  findings: [{
    id: 'runtime.operation-unobserved:GET:/pets/{}',
    code: 'runtime.operation-unobserved',
    severity: 'error',
    location: { kind: 'operation', method: 'GET', path: '/pets/{id}' },
    message: 'OpenAPI documents GET /pets/{id}, but the running backend does not expose that operation.',
    expected: 'Operation is exposed by the running backend',
    observed: 'No matching runtime operation exists',
  }],
  summary: { total: 1, errors: 1, warnings: 0, info: 0 },
};

const infoValidation = {
  status: 'partial',
  complete: false,
  findings: [{
    id: 'runtime.operation-unobserved:GET:/pets/{}',
    code: 'runtime.operation-unobserved',
    severity: 'info',
    location: { kind: 'operation', method: 'GET', path: '/pets/{id}' },
    message: 'OpenAPI documents GET /pets/{id}, but it was not observed during partial runtime discovery.',
    expected: 'Operation is exposed by the running backend',
    observed: 'No matching operation was observed during partial discovery',
  }],
  summary: { total: 1, errors: 0, warnings: 0, info: 1 },
};

test('parses backend contract validation and rejects inconsistent summaries/status', () => {
  assert.deepEqual(parseContractValidationResult(warningValidation), warningValidation);
  assert.throws(
    () => parseContractValidationResult({ ...warningValidation, summary: { ...warningValidation.summary, warnings: 0 } }),
    /summary does not match findings/,
  );
  assert.throws(
    () => parseContractValidationResult({ ...warningValidation, status: 'pass' }),
    /inconsistent with findings\/completeness/,
  );
});

test('fetches validation from the backend Runtime Intelligence snapshot', async () => {
  const calls = [];
  const result = await fetchRuntimeContractValidation('https://api.example.test/docs/__flexdoc/runtime', {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ framework: 'express', validation: warningValidation }) };
    },
  });
  assert.deepEqual(result, warningValidation);
  assert.equal(calls[0].url, 'https://api.example.test/docs/__flexdoc/runtime');
  assert.equal(calls[0].init.headers.accept, 'application/json');
});

test('sends repeated custom headers plus bearer authentication to protected runtime endpoints', async () => {
  const calls = [];
  const exitCode = await runValidationCli([
    'https://api.example.test/docs/__flexdoc/runtime',
    '--header', 'X-CI-Run: build-42',
    '--header', 'X-Tenant: pets',
    '--bearer', 'secret-token',
  ], {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ validation: warningValidation }) };
    },
    log: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].init.headers['X-CI-Run'], 'build-42');
  assert.equal(calls[0].init.headers['X-Tenant'], 'pets');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('supports basic authentication and rejects ambiguous Authorization configuration', async () => {
  const calls = [];
  await runValidationCli([
    'https://api.example.test/docs/__flexdoc/runtime',
    '--basic', 'ci-user:ci-pass',
  ], {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ validation: warningValidation }) };
    },
    log: () => {},
  });
  assert.equal(calls[0].init.headers.Authorization, 'Basic Y2ktdXNlcjpjaS1wYXNz');

  await assert.rejects(
    () => runValidationCli([
      'https://api.example.test/docs/__flexdoc/runtime',
      '--header', 'Authorization: Token custom',
      '--bearer', 'secret-token',
    ], {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: warningValidation }) }),
      log: () => {},
    }),
    /Do not combine --bearer\/--basic with an explicit Authorization header/,
  );
});

test('requires a 3.1 validation result rather than reimplementing validation in the CLI', async () => {
  await assert.rejects(
    () => fetchRuntimeContractValidation('https://api.example.test/docs/__flexdoc/runtime', {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ framework: 'express' }) }),
    }),
    /does not include FlexDoc 3.1 contract validation/,
  );
});

test('formats actionable human output for CI logs', () => {
  const output = formatContractValidationResult(warningValidation);
  assert.match(output, /FlexDoc contract validation: WARN/);
  assert.match(output, /runtime\.duplicate-operation · GET \/pets\/\{id\}/);
  assert.match(output, /Expected: One runtime registration/);
  assert.match(output, /Observed: 2 runtime registrations/);
});

test('default validate policy exits 1 only for backend fail status', async () => {
  const output = [];
  const failureCode = await runValidationCli(['https://api.example.test/docs/__flexdoc/runtime', '--json'], {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: failingValidation }) }),
    log: (value) => output.push(value),
  });
  assert.equal(failureCode, 1);
  assert.deepEqual(JSON.parse(output[0]), failingValidation);

  const warningCode = await runValidationCli(['https://api.example.test/docs/__flexdoc/runtime'], {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: warningValidation }) }),
    log: () => {},
  });
  assert.equal(warningCode, 0);

  const partialCode = await runValidationCli(['https://api.example.test/docs/__flexdoc/runtime'], {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: infoValidation }) }),
    log: () => {},
  });
  assert.equal(partialCode, 0);
});

test('optional --fail-on policy can fail CI on warnings or informational findings', async () => {
  const warningCode = await runValidationCli([
    'https://api.example.test/docs/__flexdoc/runtime',
    '--fail-on', 'warning',
  ], {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: warningValidation }) }),
    log: () => {},
  });
  assert.equal(warningCode, 1);

  const infoCode = await runValidationCli([
    'https://api.example.test/docs/__flexdoc/runtime',
    '--fail-on', 'info',
  ], {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: infoValidation }) }),
    log: () => {},
  });
  assert.equal(infoCode, 1);

  await assert.rejects(
    () => runValidationCli([
      'https://api.example.test/docs/__flexdoc/runtime',
      '--fail-on', 'warning-or-worse',
    ], {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ validation: warningValidation }) }),
      log: () => {},
    }),
    /Invalid --fail-on value/,
  );
});
