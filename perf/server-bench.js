// Server benchmark — real Express + Socket.io + MongoDB, with a latency proxy in front of the DB.
//
//   node perf/server-bench.js --label before            # RTT 70ms (measured in production)
//   node perf/server-bench.js --rtt 2 --label same-region  # assumes a same-region DB
//
// What is measured
//   · the 4 home feed APIs plus their concurrent wall-clock time  (HomeScreen first load)
//   · GET /auth/me                                              (cold-start session restore)
//   · chat send → sender echo / recipient delivery              (message round-trip latency)
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { summarize, printTable, saveResult, sleep, out } = require('./lib');
const { startLatencyProxy } = require('./latency-proxy');

// Resolve modules against server/node_modules
const sreq = createRequire(path.join(__dirname, '../server/package.json'));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const RTT = Number(args.rtt ?? 70);
const N = parseInt(args.n || '40', 10);
const LABEL = args.label || null;
// Hot-post call style: older apps fetched all 52 and used 5; the current app passes top=5.
const HOT_TOP = args['hot-top'] ? `&top=${args['hot-top']}` : '';

// Test-only environment — production keys and DB are never used
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'bench-secret',
  RESEND_API_KEY: 're_bench_dummy',
  CLOUDINARY_CLOUD_NAME: 'bench', CLOUDINARY_API_KEY: 'bench', CLOUDINARY_API_SECRET: 'bench',
});
const log = (...a) => out(a.join(' '));
console.log = () => {}; // Hide the server's socket logs (results go straight to stdout via out())

async function main() {
  const mongoose = sreq('mongoose');
  const { MongoMemoryServer } = sreq('mongodb-memory-server');
  const jwt = sreq('jsonwebtoken');
  const bcrypt = sreq('bcryptjs');
  const { io: ioClient } = sreq('socket.io-client');

  // 1) mongod + the latency proxy
  const mongod = await MongoMemoryServer.create();
  const { port: mport } = new URL(mongod.getUri().replace('mongodb://', 'http://'));
  const { server: proxy, port: pport } = await startLatencyProxy({ targetHost: '127.0.0.1', targetPort: Number(mport), rttMs: RTT });
  // Same pool settings as production (server/db.js)
  await mongoose.connect(`mongodb://127.0.0.1:${pport}/bench?directConnection=true`, {
    serverSelectionTimeoutMS: 10000, maxPoolSize: 10,
  });

  const User = sreq('./models/User');
  const Board = sreq('./models/Board');
  const Post = sreq('./models/Post');
  const Notice = sreq('./models/Notice');
  const ChatRoom = sreq('./models/ChatRoom');

  // 2) Seed — the production shape: 13 boards, 40 users, 600 posts (60 in the last 48h), 6 announcements
  log(`seeding (DB RTT ${RTT}ms)…`);
  const slugs = ['free','anonymous','meetup','market','jobs','roomrent','exchange','immigration','study','workingholiday','car','giveaway','realestate'];
  const boards = await Board.insertMany(slugs.map((slug, i) => ({ slug, name: slug, sortOrder: i + 1, isUniversityBoard: false })));
  const hash = await bcrypt.hash('bench1234', 4);
  const users = await User.insertMany(Array.from({ length: 40 }, (_, i) => ({
    email: `u${i}@bench.local`, nickname: `user${i}`, passwordHash: hash, emailVerified: true,
    bio: 'x'.repeat(200), // Populate the fields the way a real user document looks
  })));
  const now = Date.now();
  const posts = [];
  for (let i = 0; i < 600; i++) {
    const recent = i < 60;
    posts.push({
      boardId: boards[i % boards.length]._id,
      userId: users[i % users.length]._id,
      title: `Post ${i}`,
      content: `<p>${'본문 내용입니다. '.repeat(40)}</p>`,
      likeCount: recent ? (i * 7) % 13 : 0,
      commentCount: recent ? (i * 3) % 9 : 0,
      createdAt: new Date(now - (recent ? (i % 47) * 3600e3 : (3 + i) * 86400e3)),
    });
  }
  await Post.insertMany(posts);
  await Notice.insertMany(Array.from({ length: 6 }, (_, i) => ({
    title: `공지 ${i}`, content: '<p>공지 내용</p>', authorId: users[0]._id, pinned: i === 0,
  })));
  const [alice, bob, carol] = users;
  const dm = await ChatRoom.create({ kind: 'dm', participants: [alice._id, bob._id], status: 'accepted', requesterId: alice._id });
  const group = await ChatRoom.create({ kind: 'group', groupName: 'bench', participants: users.slice(0, 10).map((u) => u._id), status: 'accepted' });

  // 3) Start the app and sockets
  const app = sreq('./app');
  const initSocket = sreq('./socket');
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 8 });

  const tok = (u) => jwt.sign({ id: u._id, email: u.email, nickname: u.nickname, v: 0 }, process.env.JWT_SECRET);
  const get = (p, token) => new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    http.get(base + p, { agent, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
      let body = ''; res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`${p} → ${res.statusCode} ${body.slice(0, 200)}`));
        resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, bytes: Buffer.byteLength(body), body });
      });
    }).on('error', reject);
  });

  // The same 5 calls HomeScreen.loadAll() makes with Promise.all
  const ENDPOINTS = {
    'GET /posts/hot-by-board': `/api/posts/hot-by-board?limit=4${HOT_TOP}`,
    'GET /posts/home-sections': '/api/posts/home-sections',
    'GET /boards': '/api/boards',
    'GET /notices': '/api/notices',
    'GET /notifications/unread-count': '/api/notifications/unread-count',
  };
  const aliceTok = tok(alice);

  // Warm up (fill the connection pool, let the JIT settle)
  for (let i = 0; i < 5; i++) { await Promise.all(Object.values(ENDPOINTS).map((p) => get(p, aliceTok))); await get('/api/auth/me', aliceTok); }
  await sleep(5500); // Keeps the systemGuard cache (5s) behaving consistently across the measured window

  const results = {};
  const payload = {};
  // 4) Individual endpoints, as a logged-in user (the app always sends a token)
  for (const [name, p] of Object.entries(ENDPOINTS)) {
    const xs = [];
    for (let i = 0; i < N; i++) { const r = await get(p, aliceTok); xs.push(r.ms); payload[name] = r.bytes; }
    results[name] = summarize(xs);
  }
  // 5) The same concurrent call HomeScreen makes
  {
    const xs = [];
    for (let i = 0; i < N; i++) {
      const t0 = process.hrtime.bigint();
      await Promise.all(Object.values(ENDPOINTS).map((p) => get(p, aliceTok)));
      xs.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    results['HOME FEED (5 concurrent, wall)'] = summarize(xs);
  }
  // 6) Cold-start session restore
  {
    const xs = [];
    for (let i = 0; i < N; i++) xs.push((await get('/api/auth/me', aliceTok)).ms);
    results['GET /auth/me (session restore)'] = summarize(xs);
  }

  // 7) Chat round trip
  const connect = (u) => new Promise((resolve, reject) => {
    const s = ioClient(base, { auth: { token: tok(u) }, transports: ['websocket'], forceNew: true, reconnection: false });
    s.once('connect', () => resolve(s)); s.once('connect_error', reject);
  });
  const once = (s, ev, pred) => new Promise((resolve) => {
    const h = (p) => { if (!pred || pred(p)) { s.off(ev, h); resolve(p); } };
    s.on(ev, h);
  });
  const chatBench = async (room, sender, receiver, label) => {
    const sS = await connect(sender), rS = await connect(receiver);
    const roomId = String(room._id);
    sS.emit('join_room', roomId); rS.emit('join_room', roomId);
    await sleep(200);
    const echo = [], deliver = [];
    for (let i = 0; i < N; i++) {
      const content = `${label}-${i}-${Date.now()}`;
      const t0 = process.hrtime.bigint();
      const pEcho = once(sS, 'new_message', (m) => m.content === content).then(() => Number(process.hrtime.bigint() - t0) / 1e6);
      const pDel = once(rS, 'new_message', (m) => m.content === content).then(() => Number(process.hrtime.bigint() - t0) / 1e6);
      sS.emit('send_message', { roomId, content });
      const [e, d] = await Promise.all([pEcho, pDel]);
      echo.push(e); deliver.push(d);
      await sleep(30);
    }
    sS.disconnect(); rS.disconnect();
    results[`CHAT ${label}: send → own echo`] = summarize(echo);
    results[`CHAT ${label}: send → peer receives`] = summarize(deliver);
  };
  await chatBench(dm, alice, bob, 'DM');
  await chatBench(group, alice, carol, 'group');

  // 8) Print and save
  printTable(`Server-side latency — DB RTT ${RTT}ms injected, client on localhost`, Object.entries(results));
  log('\nPayload size');
  for (const [k, b] of Object.entries(payload)) log(`  ${k.padEnd(34)}${(b / 1024).toFixed(1).padStart(8)} KB`);
  if (LABEL) saveResult(`server-bench-${LABEL}`, { rttMs: RTT, n: N, hotTop: args['hot-top'] || null, latency: results, payloadBytes: payload });

  await sleep(1500); // Wait for the send_message handler's post-emit work (looking up push targets) to finish
  io.close(); agent.destroy();
  await new Promise((r) => httpServer.close(r));
  await mongoose.disconnect(); proxy.close(); await mongod.stop();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
