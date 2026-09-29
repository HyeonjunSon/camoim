// Apple / Google ID token verification and profile extraction helpers
const appleSignin = require('apple-signin-auth');
const { OAuth2Client } = require('google-auth-library');

// ── Apple ──
// Verify the identityToken sent by the client and return { sub, email, emailRelay }
async function verifyAppleIdToken(identityToken) {
  const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID; // bundleId
  if (!APPLE_CLIENT_ID) throw new Error('APPLE_CLIENT_ID env missing');

  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });
  if (!payload?.sub) throw new Error('Invalid Apple token (no sub)');
  return {
    sub: payload.sub,
    email: payload.email || null, // A relay address when the user chose "hide my email"
    emailVerified: !!payload.email_verified,
    isPrivateEmail: !!payload.is_private_email, // privaterelay.appleid.com
  };
}

// Revoke the Apple token (on account deletion)
// This needs a refresh token, which the client often cannot supply.
// Best effort for now: call it when a refresh token is stored, otherwise skip
async function revokeAppleToken(refreshToken) {
  if (!refreshToken) return false;
  const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
  const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
  const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
  const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    console.warn('[apple] revoke skipped — env vars missing');
    return false;
  }
  try {
    const clientSecret = appleSignin.getClientSecret({
      clientID: APPLE_CLIENT_ID,
      teamID: APPLE_TEAM_ID,
      keyIdentifier: APPLE_KEY_ID,
      privateKey: APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      expAfter: 15777000, // 6 months in seconds
    });
    await appleSignin.revokeAuthorizationToken(refreshToken, {
      clientID: APPLE_CLIENT_ID,
      clientSecret,
      tokenTypeHint: 'refresh_token',
    });
    return true;
  } catch (err) {
    console.error('[apple] revoke failed:', err.message);
    return false;
  }
}

// ── Google ──
// Verify the idToken received from the iOS native client
async function verifyGoogleIdToken(idToken) {
  const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID;
  const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!GOOGLE_IOS_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID) {
    throw new Error('GOOGLE client ids missing');
  }
  // Accept a token issued for either client ID (audience array)
  const audience = [GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID].filter(Boolean);
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('Invalid Google token (no sub)');
  return {
    sub: payload.sub,
    email: payload.email || null,
    emailVerified: !!payload.email_verified,
    name: payload.name || '',
    picture: payload.picture || '',
  };
}

module.exports = {
  verifyAppleIdToken,
  revokeAppleToken,
  verifyGoogleIdToken,
};
