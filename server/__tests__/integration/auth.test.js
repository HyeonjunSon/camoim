// Auth flow integration tests — the real Express app on an in-memory MongoDB
// Only email delivery (Resend) is mocked; everything else runs the production code path.
jest.mock('../../utils/mailer', () => ({
  generateCode: () => '123456',
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Apple/Google token verification talks to the provider over the network
jest.mock('../../utils/socialAuth', () => ({
  verifyAppleIdToken: jest.fn(),
  verifyGoogleIdToken: jest.fn(async () => ({ sub: 'google-sub-1', email: 'social@test.local' })),
}));

const request = require('supertest');
const db = require('../helpers/db');
const { createUser, tokenFor, DEFAULT_PASSWORD } = require('../helpers/factories');

let app;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
});
afterEach(() => db.clear());
afterAll(() => db.close());

// Helper that registers a user through the full send-code to check-code to register flow
async function signUp(email, password = DEFAULT_PASSWORD, nickname = 'newbie') {
  await request(app).post('/api/auth/send-code').send({ email }).expect(200);
  await request(app).post('/api/auth/check-code').send({ email, code: '123456' }).expect(200);
  return request(app).post('/api/auth/register').send({ email, password, nickname });
}

describe('POST /api/auth/register', () => {
  it('registers and returns a token once the email is verified', async () => {
    const res = await signUp('new@test.local');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe('new@test.local');
    expect(res.body.data.user.emailVerified).toBe(true);
    // The password hash must never appear in a response
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('400 when registering without email verification', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'skip@test.local', password: DEFAULT_PASSWORD, nickname: 'skipper' });
    expect(res.status).toBe(400);
  });

  it('400 when a required field is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@test.local' });
    expect(res.status).toBe(400);
  });

  it('400 when the password is shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.local', password: '12345', nickname: 'shorty' });
    expect(res.status).toBe(400);
  });

  it('409 when the email or nickname is already taken', async () => {
    const existing = await createUser({ email: 'dup@test.local', nickname: 'dupnick' });
    const byEmail = await request(app)
      .post('/api/auth/register')
      .send({ email: existing.email, password: DEFAULT_PASSWORD, nickname: 'other' });
    expect(byEmail.status).toBe(409);

    const byNickname = await request(app)
      .post('/api/auth/register')
      .send({ email: 'fresh@test.local', password: DEFAULT_PASSWORD, nickname: existing.nickname });
    expect(byNickname.status).toBe(409);
  });

  it('falls back to the general role for a disallowed role (blocks admin escalation)', async () => {
    await request(app).post('/api/auth/send-code').send({ email: 'evil@test.local' }).expect(200);
    await request(app).post('/api/auth/check-code').send({ email: 'evil@test.local', code: '123456' }).expect(200);
    const res = await request(app).post('/api/auth/register').send({
      email: 'evil@test.local', password: DEFAULT_PASSWORD, nickname: 'evil', role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('general');
  });
});

describe('POST /api/auth/check-code', () => {
  it('400 on a wrong code', async () => {
    await request(app).post('/api/auth/send-code').send({ email: 'wrong@test.local' }).expect(200);
    const res = await request(app)
      .post('/api/auth/check-code')
      .send({ email: 'wrong@test.local', code: '999999' });
    expect(res.status).toBe(400);
  });

  it('400 for an email that was never sent a code', async () => {
    const res = await request(app)
      .post('/api/auth/check-code')
      .send({ email: 'never@test.local', code: '123456' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const user = await createUser({ email: 'login@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.id).toBe(String(user._id));
  });

  it('ignores email casing', async () => {
    const user = await createUser({ email: 'case@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'CASE@TEST.LOCAL', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(String(user._id));
  });

  it('401 on a wrong password', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('401 for a nonexistent account (never leaks whether it exists)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('403 ACCOUNT_DELETED for a deleted account', async () => {
    const user = await createUser({ status: 'deleted' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DELETED');
  });

  it('401 SOCIAL_ONLY for a social-only account with no password', async () => {
    const user = await createUser({ passwordHash: null, googleSub: 'google-123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SOCIAL_ONLY');
  });

  it('locks the account after repeated failures', async () => {
    const user = await createUser();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'nope' });
    }
    expect(last.body.code).toBe('ACCOUNT_LOCKED');
    // Once locked out, even the correct password is refused with a 423
    const locked = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(locked.status).toBe(423);
  });
});

describe('GET /api/auth/me (requireAuth)', () => {
  it('returns my profile when a token is present', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(user._id));
    expect(res.body.data.hasPassword).toBe(true);
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 for a token with a broken signature', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('old tokens become invalid once a password change bumps tokenVersion (TOKEN_REVOKED)', async () => {
    const user = await createUser();
    const oldToken = tokenFor(user); // v: 0
    user.tokenVersion = 1;
    await user.save();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');
  });

  it('403 ACCOUNT_SUSPENDED for a suspended account', async () => {
    const user = await createUser({
      status: 'suspended',
      suspendedUntil: new Date(Date.now() + 60_000),
      suspendReason: '약관 위반',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('an expired suspension is lifted automatically and the request passes', async () => {
    const user = await createUser({
      status: 'suspended',
      suspendedUntil: new Date(Date.now() - 60_000),
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
  });
});

// hasPassword tells the delete-account screen whether to ask for a password or for the nickname.
// It used to be hand-written into GET /auth/me only, so every other response that carries a user
// (login, register, apple, google, social-complete) shipped it as undefined — and a Google user who
// deleted their account in the same session they signed in was asked for a password they never set.
// These tests pin the flag to the paths that actually feed AuthContext.
describe('hasPassword', () => {
  it('is false on the Google sign-in response for a social-only account', async () => {
    await createUser({
      email: 'social@test.local',
      googleSub: 'google-sub-1',
      passwordHash: undefined,
    });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.hasPassword).toBe(false);
  });

  it('is true on the login and register responses for an email account', async () => {
    const registered = await signUp('haspw@test.local');
    expect(registered.body.data.user.hasPassword).toBe(true);

    const loggedIn = await request(app)
      .post('/api/auth/login')
      .send({ email: 'haspw@test.local', password: DEFAULT_PASSWORD });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.data.user.hasPassword).toBe(true);
  });
});

// Retyping the nickname confirms every account, whatever it signed up with. A password is only
// still read for app builds older than the OTA that removed the field.
describe('DELETE /api/auth/me', () => {
  it('deletes a social-only account on a matching nickname', async () => {
    const user = await createUser({ nickname: 'socialite', passwordHash: undefined });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ confirmText: 'socialite' });

    expect(res.status).toBe(200);
  });

  it('deletes an email account on a matching nickname, without its password', async () => {
    const user = await createUser({ nickname: 'emailer' });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ confirmText: 'emailer' });

    expect(res.status).toBe(200);
  });

  it('ignores surrounding whitespace in the typed nickname', async () => {
    const user = await createUser({ nickname: 'spaced' });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ confirmText: '  spaced  ' });

    expect(res.status).toBe(200);
  });

  it('401 on a mismatched nickname', async () => {
    const user = await createUser({ nickname: 'careful' });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ confirmText: 'carefull' });

    expect(res.status).toBe(401);
  });

  it('400 when neither a nickname nor a password is sent', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ reason: 'just because' });

    expect(res.status).toBe(400);
  });

  it('still accepts a correct password from an older app build', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
  });

  it('401 when an older app build sends the wrong password', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('400 when an older app build sends a password for a social-only account', async () => {
    const user = await createUser({ passwordHash: undefined });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ password: DEFAULT_PASSWORD });

    expect(res.status).toBe(400);
  });
});
