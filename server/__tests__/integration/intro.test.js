// Intro board: fully anonymous requests/accepts. Covers the parts that are easy to get
// wrong — daily limits, contact staying hidden until accept, decline being silent, and
// the resulting chat room never leaking either side's real nickname.
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

let app, IntroPost, IntroRequest, ChatRoom, Block;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  IntroPost = require('../../models/IntroPost');
  IntroRequest = require('../../models/IntroRequest');
  ChatRoom = require('../../models/ChatRoom');
  Block = require('../../models/Block');
});
afterEach(() => db.clear());
afterAll(() => db.close());

async function agree(user) {
  await request(app).post('/api/intro/agree').set('Authorization', `Bearer ${tokenFor(user)}`).expect(200);
}

function createBody(overrides = {}) {
  return {
    mode: 'self', gender: 'female', birthYear: 1998, region: 'toronto',
    headline: 'Hello there', contactType: 'instagram', contactValue: 'handle',
    ...overrides,
  };
}

describe('POST /api/intro — create', () => {
  it('allows an unverified (school/email) account to post and browse — the board is open to everyone', async () => {
    const user = await createUser({ verified: false });
    await agree(user);
    const created = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(user)}`).send(createBody()).expect(201);
    expect(created.body.success).toBe(true);

    const otherUnverified = await createUser({ verified: false });
    const list = await request(app).get('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(otherUnverified)}`).expect(200);
    expect(list.body.data.find((p) => String(p.id) === String(created.body.data.id))).toBeDefined();
  });

  it('rejects before the one-time rules agreement', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(user)}`).send(createBody()).expect(403);
    expect(res.body.success).toBe(false);
  });

  it('requires proxyConsent when mode is proxy', async () => {
    const user = await createUser();
    await agree(user);
    const res = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(createBody({ mode: 'proxy', proxyConsent: false })).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('stores an explicit null preferred-age range as null, not 0 (Number(null) === 0 is a trap)', async () => {
    const user = await createUser();
    await agree(user);
    const created = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(createBody({ preferredBirthYearMin: null, preferredBirthYearMax: null })).expect(201);
    expect(created.body.data.preferredBirthYearMin).toBeNull();
    expect(created.body.data.preferredBirthYearMax).toBeNull();
  });

  it('creates a post and never exposes contact to a non-owner browsing the list', async () => {
    const owner = await createUser();
    await agree(owner);
    const created = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send(createBody({ photo: 'https://res.cloudinary.com/demo/image/upload/v1/camoim/intro/a.jpg' })).expect(201);
    expect(created.body.data.contactValue).toBe('handle'); // Owner sees their own contact right after posting

    const other = await createUser();
    const list = await request(app).get('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(other)}`).expect(200);
    const row = list.body.data.find((p) => String(p.id) === String(created.body.data.id));
    expect(row.hasContact).toBe(true);
    expect(row.contactValue).toBe('');
    // Unlike contact info, the photo (when set) is public immediately — it's how people decide to apply
    expect(row.photo).toBe('https://res.cloudinary.com/demo/image/upload/v1/camoim/intro/a.jpg');

    // The owner's own post never appears in their own browse list
    const ownList = await request(app).get('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(owner)}`).expect(200);
    expect(ownList.body.data.find((p) => String(p.id) === String(created.body.data.id))).toBeUndefined();
  });
});

describe('POST /api/intro/:id/requests — apply to chat', () => {
  async function setupPost() {
    const owner = await createUser();
    await agree(owner);
    const created = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(owner)}`).send(createBody()).expect(201);
    return { owner, introId: created.body.data.id };
  }

  it('blocks applying to your own post', async () => {
    const { owner, introId } = await setupPost();
    const res = await request(app).post(`/api/intro/${introId}/requests`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .send({ message: 'hi', gender: 'male', birthYear: 1995, region: 'toronto' }).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('blocks a second pending request to the same post', async () => {
    const { introId } = await setupPost();
    const requester = await createUser();
    await agree(requester);
    const body = { message: 'hi', gender: 'male', birthYear: 1995, region: 'toronto' };
    await request(app).post(`/api/intro/${introId}/requests`)
      .set('Authorization', `Bearer ${tokenFor(requester)}`).send(body).expect(201);
    const res = await request(app).post(`/api/intro/${introId}/requests`)
      .set('Authorization', `Bearer ${tokenFor(requester)}`).send(body).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('enforces the daily request limit across different posts', async () => {
    const requester = await createUser();
    await agree(requester);
    const owner = await createUser();
    await agree(owner);

    // Create 11 posts from the owner and apply to each as the requester — the 11th should 429
    let lastStatus;
    for (let i = 0; i < 11; i++) {
      const created = await request(app).post('/api/intro')
        .set('Authorization', `Bearer ${tokenFor(owner)}`)
        .send(createBody({ headline: `post ${i}` })).expect(201);
      const res = await request(app).post(`/api/intro/${created.body.data.id}/requests`)
        .set('Authorization', `Bearer ${tokenFor(requester)}`)
        .send({ message: 'hi', gender: 'male', birthYear: 1995, region: 'toronto' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('excludes posts from a blocked user in the browse list', async () => {
    const { owner, introId } = await setupPost();
    const viewer = await createUser();
    await Block.create({ blockerId: viewer._id, blockedId: owner._id, hideContent: true });

    const list = await request(app).get('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`).expect(200);
    expect(list.body.data.find((p) => String(p.id) === String(introId))).toBeUndefined();
  });
});

describe('Accept / decline', () => {
  async function setupRequest() {
    const owner = await createUser();
    await agree(owner);
    const created = await request(app).post('/api/intro')
      .set('Authorization', `Bearer ${tokenFor(owner)}`).send(createBody()).expect(201);
    const requester = await createUser();
    await agree(requester);
    const applied = await request(app).post(`/api/intro/${created.body.data.id}/requests`)
      .set('Authorization', `Bearer ${tokenFor(requester)}`)
      .send({ message: 'hi', gender: 'male', birthYear: 1995, region: 'toronto' }).expect(201);
    return { owner, requester, introId: created.body.data.id, requestId: applied.body.data.id };
  }

  it('accept reveals the contact to the requester and opens an anonymous dm', async () => {
    const { owner, requester, introId, requestId } = await setupRequest();

    const accept = await request(app).put(`/api/intro/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`).expect(200);
    const roomId = accept.body.data.roomId;

    const room = await ChatRoom.findById(roomId).lean();
    expect(String(room.introPostId)).toBe(String(introId));
    expect(room.status).toBe('accepted');
    expect(room.participants.map(String).sort()).toEqual([String(owner._id), String(requester._id)].sort());

    const detail = await request(app).get(`/api/intro/${introId}`)
      .set('Authorization', `Bearer ${tokenFor(requester)}`).expect(200);
    expect(detail.body.data.contactValue).toBe('handle');
    expect(detail.body.data.myRequestStatus).toBe('accepted');

    // The chat list never reveals the real nickname for this room, for either side
    const chatList = await request(app).get('/api/chats')
      .set('Authorization', `Bearer ${tokenFor(requester)}`).expect(200);
    const row = chatList.body.data.find((r) => String(r.id) === String(roomId));
    expect(row.other.nickname).not.toBe(owner.nickname);
    expect(row.other.anonymous).toBe(true);
  });

  it('a second accept attempt on the same request fails', async () => {
    const { owner, requestId } = await setupRequest();
    await request(app).put(`/api/intro/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`).expect(200);
    const res = await request(app).put(`/api/intro/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`).expect(404);
    expect(res.body.success).toBe(false);
  });

  it('decline leaves the requester with no accepted access and creates no chat room', async () => {
    const { owner, requester, introId, requestId } = await setupRequest();

    await request(app).put(`/api/intro/requests/${requestId}/decline`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`).expect(200);

    const detail = await request(app).get(`/api/intro/${introId}`)
      .set('Authorization', `Bearer ${tokenFor(requester)}`).expect(200);
    expect(detail.body.data.contactValue).toBe('');
    expect(detail.body.data.myRequestStatus).toBe('declined');

    const rooms = await ChatRoom.countDocuments({});
    expect(rooms).toBe(0);
  });

  it('only the post owner can accept or decline', async () => {
    const { requestId } = await setupRequest();
    const stranger = await createUser();
    await request(app).put(`/api/intro/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`).expect(403);
    await request(app).put(`/api/intro/requests/${requestId}/decline`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`).expect(403);
  });
});
