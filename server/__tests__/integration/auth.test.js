// 인증 플로우 통합 테스트 — 실제 Express 앱 + in-memory MongoDB
// 이메일 발송(Resend)만 모킹하고 나머지는 운영과 동일한 코드 경로를 탄다.
jest.mock('../../utils/mailer', () => ({
  generateCode: () => '123456',
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
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

// send-code → check-code → register 전체를 거쳐 가입시키는 헬퍼
async function signUp(email, password = DEFAULT_PASSWORD, nickname = 'newbie') {
  await request(app).post('/api/auth/send-code').send({ email }).expect(200);
  await request(app).post('/api/auth/check-code').send({ email, code: '123456' }).expect(200);
  return request(app).post('/api/auth/register').send({ email, password, nickname });
}

describe('POST /api/auth/register', () => {
  it('이메일 인증을 거친 뒤에는 가입에 성공하고 토큰을 준다', async () => {
    const res = await signUp('new@test.local');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe('new@test.local');
    expect(res.body.data.user.emailVerified).toBe(true);
    // 비밀번호 해시는 절대 응답에 실리면 안 됨
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('이메일 인증 없이 가입하면 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'skip@test.local', password: DEFAULT_PASSWORD, nickname: 'skipper' });
    expect(res.status).toBe(400);
  });

  it('필수 필드가 빠지면 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@test.local' });
    expect(res.status).toBe(400);
  });

  it('비밀번호가 6자 미만이면 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.local', password: '12345', nickname: 'shorty' });
    expect(res.status).toBe(400);
  });

  it('이미 쓰는 이메일/닉네임이면 409', async () => {
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

  it('허용되지 않은 role은 general로 떨어뜨린다 (admin 승격 차단)', async () => {
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
  it('코드가 틀리면 400', async () => {
    await request(app).post('/api/auth/send-code').send({ email: 'wrong@test.local' }).expect(200);
    const res = await request(app)
      .post('/api/auth/check-code')
      .send({ email: 'wrong@test.local', code: '999999' });
    expect(res.status).toBe(400);
  });

  it('발송한 적 없는 이메일이면 400', async () => {
    const res = await request(app)
      .post('/api/auth/check-code')
      .send({ email: 'never@test.local', code: '123456' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('올바른 자격증명이면 토큰을 준다', async () => {
    const user = await createUser({ email: 'login@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.id).toBe(String(user._id));
  });

  it('이메일 대소문자는 무시한다', async () => {
    const user = await createUser({ email: 'case@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'CASE@TEST.LOCAL', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(String(user._id));
  });

  it('비밀번호가 틀리면 401', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('없는 계정이면 401 (계정 존재 여부를 흘리지 않는다)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('탈퇴한 계정이면 403 ACCOUNT_DELETED', async () => {
    const user = await createUser({ status: 'deleted' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DELETED');
  });

  it('소셜 전용 계정(비밀번호 없음)이면 401 SOCIAL_ONLY', async () => {
    const user = await createUser({ passwordHash: null, googleSub: 'google-123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SOCIAL_ONLY');
  });

  it('연속 실패가 쌓이면 계정을 잠근다', async () => {
    const user = await createUser();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'nope' });
    }
    expect(last.body.code).toBe('ACCOUNT_LOCKED');
    // 잠긴 뒤에는 올바른 비밀번호도 423으로 막힌다
    const locked = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(locked.status).toBe(423);
  });
});

describe('GET /api/auth/me (requireAuth)', () => {
  it('토큰이 있으면 내 정보를 준다', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(user._id));
    expect(res.body.data.hasPassword).toBe(true);
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('서명이 깨진 토큰이면 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('비밀번호 변경으로 tokenVersion이 오르면 옛 토큰은 무효(TOKEN_REVOKED)', async () => {
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

  it('정지된 계정이면 403 ACCOUNT_SUSPENDED', async () => {
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

  it('정지 기간이 지난 계정은 자동 해제되어 통과한다', async () => {
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
