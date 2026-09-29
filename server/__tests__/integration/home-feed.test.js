// Home feed API integration tests — guard that the results survive the caching and aggregate rewrites
jest.mock('../../utils/mailer', () => ({
  generateCode: () => '123456',
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const db = require('../helpers/db');
const { createUser, tokenFor } = require('../helpers/factories');

let app, Board, Post, Block, Notice;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  Board = require('../../models/Board');
  Post = require('../../models/Post');
  Block = require('../../models/Block');
  Notice = require('../../models/Notice');
});
afterEach(() => db.clear());
afterAll(() => db.close());

const HOUR = 3600e3;

async function seedBoards() {
  return Board.insertMany([
    { slug: 'free', name: '자유', sortOrder: 1, isUniversityBoard: false },
    { slug: 'market', name: '장터', sortOrder: 2, isUniversityBoard: false },
    { slug: 'jobs', name: '구인', sortOrder: 3, isUniversityBoard: false },
    { slug: 'ubc-free', name: 'UBC 자유', sortOrder: 1, isUniversityBoard: true, university: 'UBC' },
    { slug: 'sfu-free', name: 'SFU 자유', sortOrder: 1, isUniversityBoard: true, university: 'SFU' },
  ]);
}

function post(board, user, over = {}) {
  return {
    boardId: board._id, userId: user._id, title: 't', content: '<p>본문</p>',
    likeCount: 0, commentCount: 0, createdAt: new Date(), ...over,
  };
}

// Mirrors the hot-post processing in HomeScreen.loadAll()
function clientTop5(sections) {
  return sections
    .flatMap((s) => s.posts.map((p) => ({ ...p, boardSlug: s.boardSlug })))
    .sort((a, b) => (b.likeCount * 3 + b.commentCount) - (a.likeCount * 3 + a.commentCount))
    .slice(0, 5)
    .map((p) => p.id);
}

describe('GET /api/posts/hot-by-board', () => {
  it('returns boards in order, up to limit each, sorted by hotScore', async () => {
    const [free, market] = await seedBoards();
    const u = await createUser();
    await Post.insertMany([
      post(market, u, { title: 'm-hot', likeCount: 10 }),
      post(free, u, { title: 'f-1', likeCount: 1 }),
      post(free, u, { title: 'f-3', likeCount: 3 }),
      post(free, u, { title: 'f-2', likeCount: 2 }),
    ]);
    const res = await request(app).get('/api/posts/hot-by-board?limit=2').expect(200);
    expect(res.body.data.map((s) => s.boardSlug)).toEqual(['free', 'market']); // In sortOrder
    expect(res.body.data[0].posts.map((p) => p.title)).toEqual(['f-3', 'f-2']); // limit=2, by score
    expect(res.body.data[1].posts.map((p) => p.title)).toEqual(['m-hot']);
  });

  it('excludes posts older than 48 hours, hidden posts and school board posts', async () => {
    const boards = await seedBoards();
    const [free, , , ubc] = boards;
    const u = await createUser();
    await Post.insertMany([
      post(free, u, { title: 'ok' }),
      post(free, u, { title: 'old', createdAt: new Date(Date.now() - 49 * HOUR) }),
      post(free, u, { title: 'hidden', hidden: true }),
      post(free, u, { title: 'auto', autoHidden: true }),
      post(ubc, u, { title: 'school' }),
    ]);
    const res = await request(app).get('/api/posts/hot-by-board').expect(200);
    const titles = res.body.data.flatMap((s) => s.posts.map((p) => p.title));
    expect(titles).toEqual(['ok']);
  });

  it('excludes posts by blocked users (aggregate needs the ObjectId conversion — regression guard)', async () => {
    const [free] = await seedBoards();
    const me = await createUser();
    const blocked = await createUser();
    const other = await createUser();
    await Post.insertMany([post(free, blocked, { title: 'blocked' }), post(free, other, { title: 'visible' })]);
    await Block.create({ blockerId: me._id, blockedId: blocked._id });

    const res = await request(app)
      .get('/api/posts/hot-by-board')
      .set('Authorization', `Bearer ${tokenFor(me)}`)
      .expect(200);
    const titles = res.body.data.flatMap((s) => s.posts.map((p) => p.title));
    expect(titles).toEqual(['visible']);
  });

  it('blocking and unblocking invalidates the cache immediately', async () => {
    const [free] = await seedBoards();
    const me = await createUser();
    const target = await createUser();
    await Post.create(post(free, target, { title: 'target' }));
    const auth = { Authorization: `Bearer ${tokenFor(me)}` };
    const titles = async () =>
      (await request(app).get('/api/posts/hot-by-board').set(auth)).body.data.flatMap((s) => s.posts.map((p) => p.title));

    expect(await titles()).toEqual(['target']); // This is where the block-list cache gets filled
    const block = await Block.create({ blockerId: me._id, blockedId: target._id });
    expect(await titles()).toEqual([]); // Had the cache survived, it would still be visible
    await block.deleteOne();
    expect(await titles()).toEqual(['target']);
  });

  it('exposes only the author nickname, and anonymous posts show as anonymous', async () => {
    const [free] = await seedBoards();
    const u = await createUser({ nickname: 'writer' });
    await Post.insertMany([post(free, u, { title: 'named' }), post(free, u, { title: 'anon', isAnonymous: true })]);
    const res = await request(app).get('/api/posts/hot-by-board').expect(200);
    const byTitle = Object.fromEntries(res.body.data[0].posts.map((p) => [p.title, p]));
    expect(byTitle.named.nickname).toBe('writer');
    expect(byTitle.anon.nickname).toBe('익명');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|email/);
  });

  it('top=5 matches exactly the 5 the app used to pick from the full response', async () => {
    const [free, market, jobs] = await seedBoards();
    const u = await createUser();
    const scores = [
      [free, 9], [free, 9], [free, 8], [free, 1], [free, 0],   // free is truncated at limit 4
      [market, 9], [market, 5], [market, 5],                     // Tie → stable sort falls back to board order
      [jobs, 7], [jobs, 5], [jobs, 2],
    ];
    await Post.insertMany(scores.map(([b, likes], i) =>
      post(b, u, { title: `p${i}`, likeCount: likes, createdAt: new Date(Date.now() - i * 60e3) })));

    const full = await request(app).get('/api/posts/hot-by-board?limit=4').expect(200);
    const top = await request(app).get('/api/posts/hot-by-board?limit=4&top=5').expect(200);

    expect(clientTop5(top.body.data)).toEqual(clientTop5(full.body.data));
    const count = top.body.data.reduce((n, s) => n + s.posts.length, 0);
    expect(count).toBe(5); // Exactly 5 in the response
  });
});

describe('GET /api/posts/home-sections', () => {
  it('returns 3 free, 6 marketplace and 3 job posts, newest first', async () => {
    const [free, market, jobs] = await seedBoards();
    const u = await createUser({ nickname: 'writer' });
    const many = (b, n) => Array.from({ length: n }, (_, i) =>
      post(b, u, { title: `${b.slug}-${i}`, createdAt: new Date(Date.now() - i * 60e3) }));
    await Post.insertMany([...many(free, 5), ...many(market, 8), ...many(jobs, 5)]);

    const { data } = (await request(app).get('/api/posts/home-sections').expect(200)).body;
    expect(data.freePosts.map((p) => p.title)).toEqual(['free-0', 'free-1', 'free-2']);
    expect(data.marketPosts).toHaveLength(6);
    expect(data.jobsPosts).toHaveLength(3);
    expect(data.freePosts[0]).toMatchObject({ boardName: '자유', boardSlug: 'free', nickname: 'writer' });
  });

  it('excludes posts by blocked users (aggregate ObjectId conversion regression guard)', async () => {
    const [free] = await seedBoards();
    const me = await createUser();
    const blocked = await createUser();
    await Post.insertMany([post(free, blocked, { title: 'blocked' }), post(free, me, { title: 'mine' })]);
    await Block.create({ blockerId: me._id, blockedId: blocked._id });
    const { data } = (await request(app)
      .get('/api/posts/home-sections')
      .set('Authorization', `Bearer ${tokenFor(me)}`)
      .expect(200)).body;
    expect(data.freePosts.map((p) => p.title)).toEqual(['mine']);
  });

  it('the city filter applies only to local boards (marketplace and jobs) and expands to the metro area', async () => {
    const [free, market] = await seedBoards();
    const u = await createUser();
    await Post.insertMany([
      post(market, u, { title: 'mississauga', city: 'Mississauga' }), // Greater Toronto Area
      post(market, u, { title: 'vancouver', city: 'Vancouver' }),
      post(free, u, { title: 'free-anywhere', city: 'Vancouver' }),
    ]);
    const { data } = (await request(app).get('/api/posts/home-sections?city=Toronto').expect(200)).body;
    expect(data.marketPosts.map((p) => p.title)).toEqual(['mississauga']);
    expect(data.freePosts.map((p) => p.title)).toEqual(['free-anywhere']); // The free board ignores city
  });
});

describe('GET /api/boards', () => {
  it('logged-out and general members see only the general boards', async () => {
    await seedBoards();
    const res = await request(app).get('/api/boards').expect(200);
    expect(res.body.data.map((b) => b.slug)).toEqual(['free', 'market', 'jobs']);
  });

  it('a verified student sees their own school board but not another school', async () => {
    await seedBoards();
    const student = await createUser({ role: 'student', verified: true, university: 'UBC' });
    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .expect(200);
    const slugs = res.body.data.map((b) => b.slug);
    expect(slugs).toContain('ubc-free');
    expect(slugs).not.toContain('sfu-free');
    expect(slugs.indexOf('ubc-free')).toBeGreaterThan(slugs.indexOf('jobs')); // After the general boards
  });

  it('adding or editing a board as an admin invalidates the cache immediately', async () => {
    await seedBoards();
    await request(app).get('/api/boards').expect(200); // Fill the cache
    await Board.create({ slug: 'new', name: '신규', sortOrder: 0, isUniversityBoard: false });
    let slugs = (await request(app).get('/api/boards')).body.data.map((b) => b.slug);
    expect(slugs[0]).toBe('new');

    await Board.updateOne({ slug: 'new' }, { $set: { sortOrder: 99 } });
    slugs = (await request(app).get('/api/boards')).body.data.map((b) => b.slug);
    expect(slugs[slugs.length - 1]).toBe('new');
  });
});

describe('GET /api/notices', () => {
  it('pinned announcements come first, then newest first, with the author nickname attached', async () => {
    const admin = await createUser({ nickname: 'admin-nick' });
    await Notice.insertMany([
      { title: 'old', content: 'c', authorId: admin._id, createdAt: new Date(Date.now() - 2 * HOUR) },
      { title: 'pinned', content: 'c', authorId: admin._id, pinned: true, createdAt: new Date(Date.now() - 5 * HOUR) },
      { title: 'new', content: 'c', authorId: admin._id, createdAt: new Date() },
    ]);
    const { data } = (await request(app).get('/api/notices').expect(200)).body;
    expect(data.map((n) => n.title)).toEqual(['pinned', 'new', 'old']);
    expect(data[0].author).toBe('admin-nick');
    expect(data[0]).toHaveProperty('id');
  });
});
