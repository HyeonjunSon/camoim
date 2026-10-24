// POST /api/admin/push — a dry run must report the real reach without sending,
// and a real send must reach exactly that many people.
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
const { sendPush } = require('../../utils/push');

let app, User;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  User = require('../../models/User');
});
afterEach(async () => {
  await db.clear();
  sendPush.mockClear();
});
afterAll(() => db.close());

async function seed() {
  const admin = await createUser({ role: 'admin' });
  await createUser({ pushToken: 'ExponentPushToken[a]', city: 'Toronto' });
  await createUser({ pushToken: 'ExponentPushToken[b]', city: 'Vancouver' });
  await createUser({ pushToken: '' }); // no device
  await createUser({ pushToken: 'ExponentPushToken[c]', notificationSettings: { enabled: false } });
  await createUser({ pushToken: 'ExponentPushToken[d]', status: 'deleted' });
  // An account from before the field had a default
  await User.collection.insertOne({ email: 'old@test.local', nickname: 'old', passwordHash: 'x' });
  return tokenFor(admin);
}

const push = (token, body) =>
  request(app).post('/api/admin/push').set('Authorization', `Bearer ${token}`).send(body);

describe('admin push', () => {
  it('dry run counts only reachable accounts and sends nothing', async () => {
    const token = await seed();
    const res = await push(token, { title: 't', body: 'b', dryRun: true }).expect(200);
    expect(res.body.data.count).toBe(2);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('a real send reaches the same accounts the dry run counted', async () => {
    const token = await seed();
    const res = await push(token, { title: 't', body: 'b' }).expect(200);
    expect(res.body.data.sent).toBe(2);
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  it('narrows by city', async () => {
    const token = await seed();
    const res = await push(token, { title: 't', body: 'b', dryRun: true, target: { city: 'Toronto' } }).expect(200);
    expect(res.body.data.count).toBe(1);
  });

  it('ignores an operator smuggled into the target', async () => {
    const token = await seed();
    const res = await push(token, { title: 't', body: 'b', dryRun: true, target: { city: { $ne: 'x' } } }).expect(200);
    expect(res.body.data.count).toBe(2);
  });

  it('rejects an over-long message and a non-admin', async () => {
    const token = await seed();
    await push(token, { title: 'x'.repeat(61), body: 'b', dryRun: true }).expect(400);
    const member = await createUser();
    await push(tokenFor(member), { title: 't', body: 'b', dryRun: true }).expect(403);
  });
});
