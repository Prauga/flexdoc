import {
  clearCookiesForSession,
  createHostExecutionState,
  createInProcessHostExecutionSessionStore,
  ensureHostExecutionSession,
  publicCookiesForSession,
  publicHostExecutionOptions,
} from './host-execution';
import type { FlexDocHostExecutionSessionCookie, FlexDocHostExecutionSessionStore } from './interfaces';

const SECRET = 'a'.repeat(32);

/** One store shared by several states, standing in for Redis or a database table. */
function sharedStore(): FlexDocHostExecutionSessionStore {
  const jars = new Map<string, FlexDocHostExecutionSessionCookie[]>();
  return {
    async read(sessionId) { return jars.get(sessionId); },
    async write(sessionId, cookies) { jars.set(sessionId, [...cookies]); },
    async clear(sessionId) { jars.set(sessionId, []); },
  };
}

const cookieHeader = (setCookie: string | undefined) => setCookie?.split(';')[0];

describe('multi-instance session state', () => {
  let warnings: string[];
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warnings = [];
    warn = jest.spyOn(console, 'warn').mockImplementation((message: unknown) => { warnings.push(String(message)); });
  });

  afterEach(() => warn.mockRestore());

  it('lets a second instance verify a session cookie issued by the first', async () => {
    const first = createHostExecutionState({ sessionSecret: SECRET, sessionStore: sharedStore() });
    const issued = await ensureHostExecutionSession(first);
    expect(issued.setCookie).toBeDefined();

    const second = createHostExecutionState({ sessionSecret: SECRET, sessionStore: sharedStore() });
    const resumed = await ensureHostExecutionSession(second, cookieHeader(issued.setCookie));

    expect(resumed.sessionId).toBe(issued.sessionId);
    expect(resumed.setCookie).toBeUndefined();
  });

  it('still mints a new session when instances do not share a secret', async () => {
    const first = createHostExecutionState(true);
    const issued = await ensureHostExecutionSession(first);

    const second = createHostExecutionState(true);
    const resumed = await ensureHostExecutionSession(second, cookieHeader(issued.setCookie));

    expect(resumed.sessionId).not.toBe(issued.sessionId);
    expect(resumed.setCookie).toBeDefined();
  });

  it('carries jar contents between instances that share a store', async () => {
    const store = sharedStore();
    const first = createHostExecutionState({ sessionSecret: SECRET, sessionStore: store });
    const session = await ensureHostExecutionSession(first);
    await store.write(session.sessionId, [{
      name: 'sid', value: 'abc', domain: 'api.example.test', path: '/', secure: true, httpOnly: true, hostOnly: true,
    }]);

    const second = createHostExecutionState({ sessionSecret: SECRET, sessionStore: store });
    const resumed = await ensureHostExecutionSession(second, cookieHeader(session.setCookie));

    expect(await publicCookiesForSession(second, resumed.sessionId)).toEqual([
      { name: 'sid', value: 'abc', domain: 'api.example.test', path: '/', httpOnly: true },
    ]);
  });

  it('does not discard a verified session that the shared store has not seen yet', async () => {
    const first = createHostExecutionState({ sessionSecret: SECRET });
    const issued = await ensureHostExecutionSession(first);

    const second = createHostExecutionState({ sessionSecret: SECRET });
    const resumed = await ensureHostExecutionSession(second, cookieHeader(issued.setCookie));

    expect(resumed.sessionId).toBe(issued.sessionId);
    expect(await publicCookiesForSession(second, resumed.sessionId)).toEqual([]);
  });

  it('clears a shared jar for every instance at once', async () => {
    const store = sharedStore();
    const first = createHostExecutionState({ sessionSecret: SECRET, sessionStore: store });
    const session = await ensureHostExecutionSession(first);
    await store.write(session.sessionId, [{
      name: 'sid', value: 'abc', domain: 'api.example.test', path: '/', secure: false, httpOnly: false, hostOnly: true,
    }]);

    const second = createHostExecutionState({ sessionSecret: SECRET, sessionStore: store });
    await clearCookiesForSession(second, session.sessionId);

    expect(await publicCookiesForSession(first, session.sessionId)).toEqual([]);
  });

  it('rejects a session secret too short to be worth signing with', () => {
    expect(() => createHostExecutionState({ sessionSecret: 'short' })).toThrow(/at least 32 bytes/);
    expect(() => createHostExecutionState({ sessionSecret: Buffer.alloc(31) })).toThrow(/at least 32 bytes/);
    expect(() => createHostExecutionState({ sessionSecret: Buffer.alloc(32) })).not.toThrow();
  });

  it('withholds the cookies capability when a declared fleet cannot support it', () => {
    const state = createHostExecutionState({ instances: 'multiple' });

    expect(state.capabilities).not.toContain('cookies');
    expect(state.capabilities).toContain('digest');
    expect(state.degradations).toHaveLength(2);
    expect(publicHostExecutionOptions(state, '/docs/__flexdoc')?.capabilities).not.toContain('cookies');
  });

  it('names the missing piece rather than failing silently', () => {
    const withSecret = createHostExecutionState({ instances: 'multiple', sessionSecret: SECRET });

    expect(withSecret.degradations).toEqual([expect.stringContaining('sessionStore')]);
    expect(warnings).toEqual([expect.stringContaining('sessionStore')]);
  });

  it('advertises cookies for a fleet given both a shared secret and a shared store', () => {
    const state = createHostExecutionState({ instances: 'multiple', sessionSecret: SECRET, sessionStore: sharedStore() });

    expect(state.capabilities).toContain('cookies');
    expect(state.degradations).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('leaves single-instance behaviour untouched', () => {
    const state = createHostExecutionState(true);

    expect(state.capabilities).toContain('cookies');
    expect(state.degradations).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('defaults to an in-process store that is not shared between mounts', async () => {
    const first = createHostExecutionState({ sessionSecret: SECRET });
    const session = await ensureHostExecutionSession(first);
    await createInProcessHostExecutionSessionStore().write(session.sessionId, [{
      name: 'sid', value: 'abc', domain: 'api.example.test', path: '/', secure: false, httpOnly: false, hostOnly: true,
    }]);

    expect(await publicCookiesForSession(first, session.sessionId)).toEqual([]);
  });
});
