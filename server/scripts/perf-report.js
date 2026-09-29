// Real-user monitoring rollup — percentiles over the perf_* events the app sends. Read-only.
//
//   railway run node scripts/perf-report.js               # last 7 days, production DB
//   railway run node scripts/perf-report.js --days 3 --version 1.0.7
//   railway run node scripts/perf-report.js --since 2026-09-20   # only since an OTA release
//
// See src/lib/perf.js for the event definitions.
require('dotenv').config();
const mongoose = require('mongoose');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const DAYS = Number(args.days || 7);
const SINCE = args.since ? new Date(args.since) : new Date(Date.now() - DAYS * 86400e3);
const VERSION = args.version || null;

function pct(sorted, p) {
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}
function row(label, values) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  const f = (x) => (Number.isFinite(x) ? `${Math.round(x)}ms` : '—');
  console.log(`  ${label.padEnd(40)}${String(s.length).padStart(6)}${f(pct(s, 50)).padStart(9)}${f(pct(s, 90)).padStart(9)}${f(pct(s, 95)).padStart(9)}`);
}
function header(title) {
  console.log(`\n${title}`);
  console.log(`  ${''.padEnd(40)}${'n'.padStart(6)}${'p50'.padStart(9)}${'p90'.padStart(9)}${'p95'.padStart(9)}`);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const match = { name: /^perf_/, createdAt: { $gte: SINCE }, ...(VERSION ? { appVersion: VERSION } : {}) };
  const events = await AnalyticsEvent.find(match).select('name props platform appVersion').lean();
  console.log(`since ${SINCE.toISOString()}${VERSION ? `, appVersion ${VERSION}` : ''} — ${events.length} perf events`);

  const by = (name) => events.filter((e) => e.name === name);
  const split = (list, key) => list.reduce((m, e) => ((m[key(e)] ||= []).push(e), m), {});

  const cold = by('perf_cold_start');
  header('Cold start (JS start → first home content)');
  for (const [k, list] of Object.entries(split(cold, (e) => `${e.platform} · session from ${e.props.sessionSource}`))) {
    row(`${k}  first_content`, list.map((e) => e.props.first_content));
    row(`${k}  fonts_ready`, list.map((e) => e.props.fonts_ready));
    row(`${k}  session_ready`, list.map((e) => e.props.session_ready));
  }

  const feed = by('perf_feed_load').filter((e) => e.props.ok);
  header('Home feed load (5 APIs, wall clock)');
  for (const [k, list] of Object.entries(split(feed, (e) => `${e.platform} · ${e.props.mode}`))) row(k, list.map((e) => e.props.ms));
  const failed = by('perf_feed_load').filter((e) => !e.props.ok).length;
  if (failed) console.log(`  (failed loads: ${failed})`);

  const chat = by('perf_chat_rtt');
  header('Chat send → server echo');
  for (const [k, list] of Object.entries(split(chat, (e) => `${e.platform} · ${e.props.kind}`))) row(k, list.map((e) => e.props.ms));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
