// Anonymous posts: the client needs a real, blockable author id even though the
// display fields (userId/nickname/avatarUrl) are masked. Without this, the post's
// own author fails their own isPostAuthor check, and no one can block the author
// of an anonymous post — the exact gap Apple's Guideline 1.2 review flagged.
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

let app, Board, Post;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  Board = require('../../models/Board');
  Post = require('../../models/Post');
});
afterEach(() => db.clear());
afterAll(() => db.close());

async function makePost(owner, { anonymous }) {
  const board = await Board.create({ slug: 'free', name: '자유게시판', isAnonymousAllowed: anonymous });
  return Post.create({
    boardId: board._id,
    userId: owner._id,
    title: 'title',
    content: '<p>body</p>',
    isAnonymous: anonymous,
  });
}

describe('GET /api/posts/:postId — author id on anonymous posts', () => {
  it('masks display fields but still returns a real authorId', async () => {
    const owner = await createUser();
    const post = await makePost(owner, { anonymous: true });

    const res = await request(app).get(`/api/posts/${post._id}`).expect(200);

    expect(res.body.data.isAnonymous).toBe(true);
    expect(res.body.data.userId).toBeNull();
    expect(res.body.data.nickname).toBe('익명');
    expect(res.body.data.avatarUrl).toBeNull();
    expect(String(res.body.data.authorId)).toBe(String(owner._id));
  });

  it('lets the author pass their own isPostAuthor check on their own anonymous post', async () => {
    const owner = await createUser();
    const post = await makePost(owner, { anonymous: true });
    const token = tokenFor(owner);

    const res = await request(app)
      .get(`/api/posts/${post._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // This is what the client compares against `user.id` to decide whether to
    // show edit/delete/pin — it must equal the real owner even though the post
    // is anonymous.
    expect(String(res.body.data.authorId)).toBe(String(owner._id));
  });

  it('matches userId on a non-anonymous post (no behavior change there)', async () => {
    const owner = await createUser();
    const post = await makePost(owner, { anonymous: false });

    const res = await request(app).get(`/api/posts/${post._id}`).expect(200);

    expect(res.body.data.isAnonymous).toBe(false);
    expect(String(res.body.data.userId)).toBe(String(owner._id));
    expect(String(res.body.data.authorId)).toBe(String(owner._id));
  });

  it('a reader can block the author of an anonymous post using authorId', async () => {
    const owner = await createUser();
    const reader = await createUser();
    const post = await makePost(owner, { anonymous: true });

    const detail = await request(app).get(`/api/posts/${post._id}`).expect(200);
    const authorId = detail.body.data.authorId;

    const res = await request(app)
      .put(`/api/users/${authorId}/block`)
      .set('Authorization', `Bearer ${tokenFor(reader)}`)
      .send({ blockChat: true, hideContent: true })
      .expect(200);

    expect(res.body.data.blocked).toBe(true);
  });
});
