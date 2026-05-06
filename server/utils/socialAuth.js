// Apple / Google ID token 검증 + 사용자 정보 추출 헬퍼
const appleSignin = require('apple-signin-auth');
const { OAuth2Client } = require('google-auth-library');

// ── Apple ──
// 클라이언트가 보낸 identityToken을 검증하고 { sub, email, emailRelay } 반환
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
    email: payload.email || null, // 사용자가 "이메일 숨기기" 선택하면 relay 이메일
    emailVerified: !!payload.email_verified,
    isPrivateEmail: !!payload.is_private_email, // privaterelay.appleid.com
  };
}

// Apple 토큰 revoke (회원탈퇴 시)
// 단, refresh token이 필요한데 클라이언트에서 받기 어려운 경우가 많음.
// 현재는 best-effort: refresh token이 저장되어 있으면 호출, 없으면 skip
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
// 클라이언트(iOS native)에서 받은 idToken 검증
async function verifyGoogleIdToken(idToken) {
  const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID;
  const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!GOOGLE_IOS_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID) {
    throw new Error('GOOGLE client ids missing');
  }
  // 둘 중 어느 쪽 ID로 발급된 토큰이든 허용 (audience array)
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
