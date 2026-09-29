// Cold-start session restore — pure logic outside React (testable through dependency injection)
//
// Old behaviour: with a token present, spin until /auth/me answered. And **any** error
// cleared the token, so opening the app offline, on a timeout, during maintenance (503) or a deploy (502) logged you out.
//
// Current behaviour (stale-while-revalidate):
//   1. with a cached user, render from it at once (zero network wait)
//   2. refresh in the background via /auth/me and swap the result in
//   3. sign out only on an auth failure (401, suspended, deleted). Network and server errors keep the session.

// True only when the server explicitly says this token is no longer valid
const AUTH_FAILURE_CODES = new Set([
  'TOKEN_REVOKED',
  'ACCOUNT_BANNED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
]);

export function isAuthFailure(err) {
  if (!err) return false;
  if (err.status === 401) return true;
  return AUTH_FAILURE_CODES.has(err.code);
}

/**
 * @param {object} deps
 * @param {() => Promise<string|null>} deps.getToken
 * @param {() => Promise<object|null>} deps.getCachedUser
 * @param {() => Promise<{success:boolean,data:object}>} deps.fetchMe
 * @param {(user:object|null, source:'cache'|'network'|'none') => void} deps.onUser
 *        the user to render. May be called twice: once from cache, once from the network
 * @param {() => Promise<void>} deps.onSignedOut  clears the token and cache
 * @returns {Promise<'none'|'cache'|'network'|'signed-out'|'offline'>} which restore path was taken
 */
export async function restoreSession({ getToken, getCachedUser, fetchMe, onUser, onSignedOut }) {
  const token = await getToken();
  if (!token) {
    onUser(null, 'none');
    return 'none';
  }

  const cached = await getCachedUser();
  if (cached) onUser(cached, 'cache'); // Render right away instead of waiting on the network

  try {
    const res = await fetchMe();
    if (res?.success) {
      onUser(res.data, 'network');
      return cached ? 'cache' : 'network';
    }
    // success:false without a throw — treated as an auth failure (preserves the old behaviour)
    await onSignedOut();
    onUser(null, 'none');
    return 'signed-out';
  } catch (err) {
    if (isAuthFailure(err)) {
      await onSignedOut();
      onUser(null, 'none');
      return 'signed-out';
    }
    // Network error, timeout, 5xx or maintenance: clearing the session fixes none of them, so keep it
    if (!cached) onUser(null, 'none'); // Nothing to show, so fall back to the login screen (the token is preserved)
    return 'offline';
  }
}
