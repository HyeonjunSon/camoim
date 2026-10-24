// Hidden posts — by an admin or auto-hidden by reports — must not leak through any
// public list, and their detail page is open to the author only. The board feed,
// search, latest-per-board and public profile lists all used to show them.
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

async function seed() {
  const author = await createUser();
  const board = await Board.create({ slug: 'free', name: '자유게시판' });
  const base = { boardId: board._id, userId: author._id, content: '<p>needle</p>' };
  const shown = await Post.create({ ...base, title: 'needle shown' });
  const adminHidden = await Post.create({ ...base, title: 'needle admin', hidden: true });
  const autoHidden = await Post.create({ ...base, title: 'needle reported', autoHidden: true });
  return { author, board, shown, adminHidden, autoHidden };
}

const titles = (list) => list.map((p) => p.title).sort();

describe('hidden posts stay out of public lists', () => {
  it('board feed', async () => {
    const { board } = await seed();
    const res = await request(app).get(`/api/boards/${board._id}/posts`).expect(200);
    expect(titles(res.body.data.posts)).toEqual(['needle shown']);
    expect(res.body.data.total).toBe(1);
  });

  it('unified search and the older post search', async () => {
    await seed();
    const unified = await request(app).get('/api/search?q=needle').expect(200);
    expect(titles(unified.body.data.posts)).toEqual(['needle shown']);
    const legacy = await request(app).get('/api/posts?search=needle').expect(200);
    expect(titles(legacy.body.data)).toEqual(['needle shown']);
  });

  it('latest post per board skips a newer hidden one', async () => {
    const { board, author } = await seed();
    await Post.create({ boardId: board._id, userId: author._id, title: 'newest but hidden', content: 'x', hidden: true });
    const res = await request(app).get('/api/posts/latest-by-board').expect(200);
    const row = res.body.data.find((r) => String(r.boardId) === String(board._id));
    expect(row.latest.title).toBe('needle shown');
  });

  it('public profile', async () => {
    const { author } = await seed();
    const res = await request(app).get(`/api/users/${author._id}`).expect(200);
    const posts = res.body.data.posts ?? res.body.data.recentPosts ?? [];
    expect(titles(posts)).toEqual(['needle shown']);
  });
});

describe('hidden post detail', () => {
  it('is 403 to others, including an admin-hidden one', async () => {
    const { adminHidden, autoHidden } = await seed();
    const viewer = await createUser();
    for (const post of [adminHidden, autoHidden]) {
      await request(app).get(`/api/posts/${post._id}`).set('Authorization', `Bearer ${tokenFor(viewer)}`).expect(403);
      await request(app).get(`/api/posts/${post._id}`).expect(403);
    }
  });

  it('stays open to its author', async () => {
    const { author, adminHidden } = await seed();
    await request(app).get(`/api/posts/${adminHidden._id}`).set('Authorization', `Bearer ${tokenFor(author)}`).expect(200);
  });
});
