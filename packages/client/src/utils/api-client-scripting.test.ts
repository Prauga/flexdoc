import { runApiClientScript } from './api-client-scripting';

describe('api-client-scripting', () => {
  it('mutates a request and environment before execution', async () => {
    const result = await runApiClientScript({
      phase: 'pre-request',
      script: `
        flex.environment.set('token', 'secret-42');
        flex.variables.set('petId', '99');
        flex.request.url = '{{baseUrl}}/pets/{{petId}}';
        flex.request.headers.set('X-Token', '{{token}}');
        flex.request.method = 'PATCH';
        flex.request.body.raw = JSON.stringify({ name: 'Milo' });
        console.log('prepared', flex.request.method);
      `,
      draft: { method: 'GET', url: '{{baseUrl}}/pets/1', headers: [], body: '' },
      variables: { baseUrl: 'https://api.example.test' },
      environmentVariables: {},
    });

    expect(result.error).toBeUndefined();
    expect(result.draft.method).toBe('PATCH');
    expect(result.draft.url).toBe('{{baseUrl}}/pets/{{petId}}');
    expect(result.draft.headers).toContainEqual({ key: 'X-Token', value: '{{token}}', enabled: true });
    expect(result.draft.body).toBe('{"name":"Milo"}');
    expect(result.variables.petId).toBe('99');
    expect(result.variables.token).toBe('secret-42');
    expect(result.environmentChanges).toEqual([{ action: 'set', key: 'token', value: 'secret-42' }]);
    expect(result.logs).toEqual(['prepared PATCH']);
  });

  it('supports collection variables without bypassing higher-priority sources', async () => {
    const result = await runApiClientScript({
      phase: 'pre-request',
      script: `
        flex.collection.set('baseUrl', 'https://changed.example.test');
        flex.collection.set('shared', 'collection-changed');
        flex.collection.set('petId', '77');
        flex.environment.unset('envOnly');
      `,
      draft: { method: 'GET', url: '{{baseUrl}}/pets/{{petId}}' },
      collectionVariables: { baseUrl: 'https://collection.example.test', shared: 'collection', envOnly: 'collection-fallback' },
      externalVariables: { shared: 'external' },
      environmentVariables: { envOnly: 'environment' },
      variables: {
        baseUrl: 'https://collection.example.test',
        shared: 'external',
        envOnly: 'environment',
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.collectionVariables).toMatchObject({
      baseUrl: 'https://changed.example.test',
      shared: 'collection-changed',
      petId: '77',
      envOnly: 'collection-fallback',
    });
    expect(result.variables.baseUrl).toBe('https://changed.example.test');
    expect(result.variables.shared).toBe('external');
    expect(result.variables.envOnly).toBe('collection-fallback');
    expect(result.variables.petId).toBe('77');
    expect(result.collectionChanges).toEqual([
      { action: 'set', key: 'baseUrl', value: 'https://changed.example.test' },
      { action: 'set', key: 'shared', value: 'collection-changed' },
      { action: 'set', key: 'petId', value: '77' },
    ]);
    expect(result.environmentChanges).toEqual([{ action: 'unset', key: 'envOnly' }]);
  });

  it('runs post-response tests and records failures without aborting the script', async () => {
    const result = await runApiClientScript({
      phase: 'tests',
      script: `
        flex.test('status is 200', () => flex.expect(flex.response.code).to.equal(200));
        flex.test('body has pet id', () => flex.expect(flex.response.json()).to.have.property('id', 42));
        flex.test('intentional failure', () => flex.expect(flex.response.headers.get('x-trace')).to.equal('wrong'));
        flex.environment.set('lastPet', String(flex.response.json().id));
        console.warn('checked response');
      `,
      draft: { method: 'GET', url: 'https://api.example.test/pets/42' },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [['x-trace', 'trace-42']],
        body: '{"id":42,"name":"Milo"}',
        responseTime: 18,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(3);
    expect(result.tests.filter((test) => test.passed)).toHaveLength(2);
    expect(result.tests.find((test) => test.name === 'intentional failure')).toMatchObject({
      passed: false,
      error: 'expected trace-42 to equal wrong',
    });
    expect(result.environmentChanges).toEqual([{ action: 'set', key: 'lastPet', value: '42' }]);
    expect(result.logs).toEqual(['WARN checked response']);
  });

  it('returns uncaught script errors separately from assertion failures', async () => {
    const result = await runApiClientScript({
      phase: 'pre-request',
      script: `throw new Error('bad setup');`,
      draft: { method: 'GET', url: 'https://api.example.test' },
    });

    expect(result.error).toBe('bad setup');
    expect(result.tests).toEqual([]);
  });
});
