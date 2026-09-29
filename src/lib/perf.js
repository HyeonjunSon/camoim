// Real-user monitoring — rides on the existing in-house analytics pipeline (lib/analytics.js).
// Server: POST /api/analytics/event → AnalyticsEvent (30-day TTL)
// Rollup: cd server && railway run node scripts/perf-report.js
//
// Events
//   perf_cold_start  JS start → first home content (only when entered via session restore)
//                    { fonts_ready, session_ready, first_content, sessionSource }
//   perf_feed_load   wall-clock time of the 5 concurrent home API calls { ms, mode, ok }
//   perf_chat_rtt    send_message emit → server echo (new_message) { ms, kind }
//                    the app does no optimistic rendering, so this is the send latency users actually feel
import { track } from './analytics';

const T0 = global.__CAMOIM_T0__ ?? Date.now();
const marks = {};
const props = {};
let startupReported = false;

// Record a cold-start milestone — only the first time for a given name (ms since JS start)
export function mark(name, extra) {
  if (marks[name] != null) return;
  marks[name] = Date.now() - T0;
  if (extra) Object.assign(props, extra);
}

// Reported once, when the first home content paints. Entering through the login screen mixes in
// human typing time, so that path is not a cold start and is not reported.
export function reportColdStart() {
  if (startupReported) return;
  startupReported = true;
  mark('first_content');
  if (props.sessionSource !== 'cache' && props.sessionSource !== 'network') return;
  track('perf_cold_start', { ...marks, ...props });
}

export function trackTiming(name, ms, extra = {}) {
  if (!Number.isFinite(ms) || ms < 0) return;
  track(name, { ms: Math.round(ms), ...extra });
}

// For tests
export function __resetPerfForTests() {
  for (const k of Object.keys(marks)) delete marks[k];
  for (const k of Object.keys(props)) delete props[k];
  startupReported = false;
}
