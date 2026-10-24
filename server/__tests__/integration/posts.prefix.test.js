// Title prefixes (말머리): stored only when the board offers them, editable,
// and filterable on the board feed.
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

function write(token, body) {
  return request(app).post('/api/posts').set('Authorization', `Bearer ${token}`).send(body);
}

describe('post prefixes', () => {
  it('stores an allowed prefix and drops a foreign one', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const market = await Board.create({ slug: 'market', name: '사고팔고' });
    const free = await Board.create({ slug: 'free', name: '자유게시판' });

    const a = await write(token, { boardId: market._id, title: 't', content: '<p>b</p>', prefix: 'buy' }).expect(201);
    const b = await write(token, { boardId: free._id, title: 't', content: '<p>b</p>', prefix: 'buy' }).expect(201);

    expect((await Post.findById(a.body.data.id)).prefix).toBe('buy');
    expect((await Post.findById(b.body.data.id)).prefix).toBe('');
  });

  it('changes on edit only when sent', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const market = await Board.create({ slug: 'market', name: '사고팔고' });
    const post = await Post.create({ boardId: market._id, userId: user._id, title: 't', content: 'b', prefix: 'sell' });

    await request(app).put(`/api/posts/${post._id}`).set('Authorization', `Bearer ${token}`)
      .send({ title: 'new' }).expect(200);
    expect((await Post.findById(post._id)).prefix).toBe('sell');

    await request(app).put(`/api/posts/${post._id}`).set('Authorization', `Bearer ${token}`)
      .send({ prefix: '' }).expect(200);
    expect((await Post.findById(post._id)).prefix).toBe('');
  });

  it('filters the board feed and returns prefix and viewCount', async () => {
    const user = await createUser();
    const market = await Board.create({ slug: 'market', name: '사고팔고' });
    await Post.create({ boardId: market._id, userId: user._id, title: 'selling', content: 'b', prefix: 'sell', viewCount: 7 });
    await Post.create({ boardId: market._id, userId: user._id, title: 'buying', content: 'b', prefix: 'buy' });

    const all = await request(app).get(`/api/boards/${market._id}/posts`).expect(200);
    expect(all.body.data.total).toBe(2);

    const res = await request(app).get(`/api/boards/${market._id}/posts?prefix=sell`).expect(200);
    expect(res.body.data.posts.map((p) => p.title)).toEqual(['selling']);
    expect(res.body.data.posts[0].prefix).toBe('sell');
    expect(res.body.data.posts[0].viewCount).toBe(7);

    // An unknown prefix is ignored rather than emptying the feed
    const junk = await request(app).get(`/api/boards/${market._id}/posts?prefix=hiring`).expect(200);
    expect(junk.body.data.total).toBe(2);
  });
});
