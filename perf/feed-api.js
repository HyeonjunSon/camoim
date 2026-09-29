// Home feed API latency — sends **read-only GETs** to the production (or a given) server.
//
//   node perf/feed-api.js                        # Railway production
//   node perf/feed-api.js --host http://localhost:4000 --label local
//   node perf/feed-api.js --n 40 --label before
//
// HomeScreen fires 5 APIs together with Promise.all. This calls the 4 that do not need auth
// (everything but unread-count) the same way, measuring both the individual latencies and the
// wall-clock time until the first screen can render (= the slowest request).
const https = require('https');
const http = require('http');
const { summarize, printTable, saveResult, sleep } = require('./lib');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const HOST = args.host || 'https://camoim-production.up.railway.app';
const N = parseInt(args.n || '30', 10);
const LABEL = args.label || null;

const ENDPOINTS = {
  'GET /posts/hot-by-board': '/api/posts/hot-by-board?limit=4',
  'GET /posts/home-sections': '/api/posts/home-sections',
  'GET /boards': '/api/boards',
  'GET /notices': '/api/notices',
};

// keep-alive agent — reuses connections like the real app, separating out the TLS handshake cost
const lib = HOST.startsWith('https') ? https : http;
const agent = new lib.Agent({ keepAlive: true, maxSockets: 8 });

function get(path) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = lib.get(HOST + path, { agent, headers: { 'x-app-version': '1.0.7' } }, (res) => {
      let bytes = 0;
      res.on('data', (c) => (bytes += c.length));
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ ms, status: res.statusCode, bytes });
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

(async () => {
  console.log(`host: ${HOST}   n=${N}`);

  // 0) Network baseline — /health (an endpoint that never touches the DB)
  await get('/health'); // Warm up the connection
  const health = [];
  for (let i = 0; i < N; i++) { health.push((await get('/health')).ms); await sleep(50); }

  // 1) Each endpoint on its own (sequential, no interference)
  const single = Object.fromEntries(Object.keys(ENDPOINTS).map((k) => [k, []]));
  const payload = {};
  for (let i = 0; i < N; i++) {
    for (const [name, path] of Object.entries(ENDPOINTS)) {
      const r = await get(path);
      if (r.status !== 200) throw new Error(`${name} → HTTP ${r.status}`);
      single[name].push(r.ms);
      payload[name] = r.bytes;
      await sleep(50);
    }
  }

  // 2) Fire them together as HomeScreen does → wall-clock time until all first-screen data has arrived
  const wall = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    await Promise.all(Object.values(ENDPOINTS).map(get));
    wall.push(Number(process.hrtime.bigint() - t0) / 1e6);
    await sleep(100);
  }

  const rows = [
    ['GET /health  (network baseline)', summarize(health)],
    ...Object.entries(single).map(([k, v]) => [k, summarize(v)]),
    ['HOME FEED (4 concurrent, wall)', summarize(wall)],
  ];
  printTable('Latency (client-observed, keep-alive)', rows);

  console.log('\nPayload size');
  for (const [k, b] of Object.entries(payload)) console.log(`  ${k.padEnd(34)}${(b / 1024).toFixed(1).padStart(8)} KB`);

  if (LABEL) {
    saveResult(`feed-api-${LABEL}`, {
      host: HOST, n: N,
      latency: Object.fromEntries(rows.map(([k, v]) => [k, v])),
      payloadBytes: payload,
    });
  }
  agent.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
