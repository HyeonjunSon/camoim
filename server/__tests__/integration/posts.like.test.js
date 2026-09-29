// Like toggle — verifies the conditional atomic update keeps counts exact under rapid taps and concurrency
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

let app, Board, Post, Notification;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  Board = require('../../models/Board');
  Post = require('../../models/Post');
  Notification = require('../../models/Notification');
});
afterEach(() => db.clear());
afterAll(() => db.close());

async function makePost(owner) {
  const board = await Board.create({ slug: 'free', name: '자유게시판' });
  return Post.create({ boardId: board._id, userId: owner._id, title: '제목', content: '<p>본문</p>' });
}

const like = (postId, token) =>
  request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${token}`);

describe('POST /api/posts/:postId/like', () => {
  it('one tap likes, another tap unlikes', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await makePost(owner);
    const token = tokenFor(liker);

    const r1 = await like(post._id, token).expect(200);
    expect(r1.body.data).toEqual({ liked: true, likeCount: 1 });

    const r2 = await like(post._id, token).expect(200);
    expect(r2.body.data).toEqual({ liked: false, likeCount: 0 });

    const saved = await Post.findById(post._id);
    expect(saved.likeCount).toBe(0);
    expect(saved.likedBy).toHaveLength(0);
  });

  it('liking someone else post notifies its author (never your own)', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await makePost(owner);

    await like(post._id, tokenFor(liker)).expect(200);
    await like(post._id, tokenFor(owner)).expect(200);

    const notifs = await Notification.find({ userId: owner._id, type: 'like' });
    expect(notifs).toHaveLength(1);
  });

  it('likeCount survives simultaneous taps from several users', async () => {
    const owner = await createUser();
    const post = await makePost(owner);
    const likers = await Promise.all(Array.from({ length: 15 }, () => createUser()));

    const results = await Promise.all(likers.map((u) => like(post._id, tokenFor(u))));
    results.forEach((r) => expect(r.status).toBe(200));

    const saved = await Post.findById(post._id);
    expect(saved.likeCount).toBe(15);
    expect(saved.likedBy).toHaveLength(15);
  });

  it('404 for a nonexistent post', async () => {
    const user = await createUser();
    await like('507f1f77bcf86cd799439011', tokenFor(user)).expect(404);
  });
});
