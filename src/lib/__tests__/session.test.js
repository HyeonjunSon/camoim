import { restoreSession, isAuthFailure } from '../session';

// Mimics the error shape thrown by request() in api.js
const httpError = (status, code) => Object.assign(new Error('x'), { status, code });
const networkError = () => new TypeError('Network request failed');
const timeoutError = () => new Error('요청 시간이 초과되었어요'); // AbortError → rt(timeoutError)

function setup({ token = 'tok', cached = null, fetchMe }) {
  const calls = [];
  const deps = {
    getToken: jest.fn().mockResolvedValue(token),
    getCachedUser: jest.fn().mockResolvedValue(cached),
    fetchMe: jest.fn(fetchMe),
    onUser: jest.fn((u, source) => calls.push([u?.id ?? null, source])),
    onSignedOut: jest.fn().mockResolvedValue(),
  };
  return { deps, calls };
}

describe('isAuthFailure', () => {
  it('only 401 and account status codes count as an auth failure', () => {
    expect(isAuthFailure(httpError(401))).toBe(true);
    expect(isAuthFailure(httpError(401, 'TOKEN_REVOKED'))).toBe(true);
    expect(isAuthFailure(httpError(403, 'ACCOUNT_BANNED'))).toBe(true);
    expect(isAuthFailure(httpError(403, 'ACCOUNT_SUSPENDED'))).toBe(true);
    expect(isAuthFailure(httpError(403, 'ACCOUNT_DELETED'))).toBe(true);
  });

  it('network, timeout, server error, maintenance and forced update are not auth failures', () => {
    expect(isAuthFailure(networkError())).toBe(false);
    expect(isAuthFailure(timeoutError())).toBe(false);
    expect(isAuthFailure(httpError(500))).toBe(false);
    expect(isAuthFailure(httpError(502))).toBe(false);
    expect(isAuthFailure(httpError(503, 'MAINTENANCE'))).toBe(false);
    expect(isAuthFailure(httpError(426, 'UPDATE_REQUIRED'))).toBe(false);
    expect(isAuthFailure(httpError(403, 'IP_BLOCKED'))).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });
});

describe('restoreSession', () => {
  it('no token means signed out, with no network call', async () => {
    const { deps, calls } = setup({ token: null, fetchMe: async () => ({}) });
    expect(await restoreSession(deps)).toBe('none');
    expect(deps.fetchMe).not.toHaveBeenCalled();
    expect(calls).toEqual([[null, 'none']]);
  });

  it('with a cache, renders the cached user before /auth/me answers, then swaps in the response', async () => {
    let resolveMe;
    const { deps, calls } = setup({
      cached: { id: 'u1', nickname: 'old' },
      fetchMe: () => new Promise((r) => (resolveMe = r)),
    });
    const done = restoreSession(deps);
    await new Promise((r) => setImmediate(r));
    expect(calls).toEqual([['u1', 'cache']]); // Already renderable while the network call is still in flight
    resolveMe({ success: true, data: { id: 'u1', nickname: 'new' } });
    expect(await done).toBe('cache');
    expect(calls).toEqual([['u1', 'cache'], ['u1', 'network']]);
    expect(deps.onUser.mock.calls[1][0].nickname).toBe('new');
  });

  it('without a cache (first run after an update), restores from the network as before', async () => {
    const { deps, calls } = setup({ fetchMe: async () => ({ success: true, data: { id: 'u1' } }) });
    expect(await restoreSession(deps)).toBe('network');
    expect(calls).toEqual([['u1', 'network']]);
  });

  describe('bug fix: an error unrelated to auth never signs the user out', () => {
    it.each([
      ['offline', networkError()],
      ['20s timeout', timeoutError()],
      ['maintenance 503', httpError(503, 'MAINTENANCE')],
      ['deploy in progress 502', httpError(502)],
      ['server error 500', httpError(500)],
    ])('%s → session kept, cached user unchanged', async (_, err) => {
      const { deps, calls } = setup({ cached: { id: 'u1' }, fetchMe: async () => { throw err; } });
      expect(await restoreSession(deps)).toBe('offline');
      expect(deps.onSignedOut).not.toHaveBeenCalled(); // This is where the token used to be cleared
      expect(calls).toEqual([['u1', 'cache']]);
    });

    it('no cache and offline goes to the login screen but keeps the token', async () => {
      const { deps, calls } = setup({ fetchMe: async () => { throw networkError(); } });
      expect(await restoreSession(deps)).toBe('offline');
      expect(deps.onSignedOut).not.toHaveBeenCalled();
      expect(calls).toEqual([[null, 'none']]);
    });
  });

  describe('signs out on an auth failure', () => {
    it.each([
      ['401', httpError(401)],
      ['TOKEN_REVOKED (password changed on another device)', httpError(401, 'TOKEN_REVOKED')],
      ['ACCOUNT_BANNED', httpError(403, 'ACCOUNT_BANNED')],
      ['ACCOUNT_SUSPENDED', httpError(403, 'ACCOUNT_SUSPENDED')],
    ])('%s → token and cache cleared, signed out', async (_, err) => {
      const { deps, calls } = setup({ cached: { id: 'u1' }, fetchMe: async () => { throw err; } });
      expect(await restoreSession(deps)).toBe('signed-out');
      expect(deps.onSignedOut).toHaveBeenCalledTimes(1);
      expect(calls).toEqual([['u1', 'cache'], [null, 'none']]); // Briefly visible from cache, then signed out
    });

    it('a success:false response also signs out (preserving the old behaviour)', async () => {
      const { deps } = setup({ cached: { id: 'u1' }, fetchMe: async () => ({ success: false }) });
      expect(await restoreSession(deps)).toBe('signed-out');
      expect(deps.onSignedOut).toHaveBeenCalled();
    });
  });
});
