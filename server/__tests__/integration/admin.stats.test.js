// GET /api/admin/stats — the shape the admin dashboard renders.
//
// Written because the web dashboard crashed on it: signupTrend came straight out
// of a $group, so its day sat in `_id` and reached the client as `id` after
// toCamel, while dauTrend in the very same response used `date`. One endpoint
// handing back two shapes is the kind of thing only a consumer finds.
jest.mock('../../utils/mailer', () => ({
  generateCode: () => '123456',
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../utils/push', () => ({
  sendPush: jest.fn().mockResolvedValue(true),
  calculateUnreadBadge: jest.fn().mockResolvedValue(0),
}));

const request = require('supertest');
const db = require('../helpers/db');
const { createUser, tokenFor } = require('../helpers/factories');

let app;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
});
afterEach(() => db.clear());
afterAll(() => db.close());

async function adminToken() {
  const admin = await createUser({ role: 'admin', nickname: 'ops', email: 'ops@test.local' });
  return tokenFor(admin);
}

describe('GET /api/admin/stats', () => {
  it('refuses a caller who is not an admin', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns the counts the dashboard tiles read', async () => {
    const token = await adminToken();
    await createUser({ status: 'suspended' });
    await createUser({ status: 'banned' });

    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const { users, content, pending, signups, posts } = res.body.data;
    for (const key of ['total', 'active', 'suspended', 'banned', 'deleted']) {
      expect(typeof users[key]).toBe('number');
    }
    expect(users.suspended).toBe(1);
    expect(users.banned).toBe(1);

    for (const key of ['posts', 'comments']) expect(typeof content[key]).toBe('number');
    for (const key of ['reports', 'verify', 'inquiry', 'groups', 'businesses']) {
      expect(typeof pending[key]).toBe('number');
    }
    for (const key of ['d1', 'd7', 'd30']) expect(typeof signups[key]).toBe('number');
    for (const key of ['d1', 'd7']) expect(typeof posts[key]).toBe('number');
  });

  it('gives both trends the same { date, count } shape', async () => {
    // The actual regression: a point with no `date` made the chart throw.
    const token = await adminToken();
    await createUser(); // one signup inside the window, so the trend is not empty

    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const { signupTrend, dau } = res.body.data;
    expect(Array.isArray(signupTrend)).toBe(true);
    expect(signupTrend.length).toBeGreaterThan(0);
    expect(Array.isArray(dau.trend)).toBe(true);
    expect(typeof dau.today).toBe('number');

    for (const point of [...signupTrend, ...dau.trend]) {
      expect(typeof point.date).toBe('string');
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof point.count).toBe('number');
      // `_id` would become `id` on the client and leave `date` undefined.
      expect(point._id).toBeUndefined();
    }
  });
});
