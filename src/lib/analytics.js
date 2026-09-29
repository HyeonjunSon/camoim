// In-house event tracking — posted straight to our own server, with no third-party SDK
// Batching: events queue up and flush every 5 seconds, or once the queue reaches 10
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { request } from './api';

const APP_VERSION = Constants.expoConfig?.version || '';
const PLATFORM = Platform.OS;

let queue = [];
let flushTimer = null;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 10;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow();
  }, FLUSH_INTERVAL_MS);
}

async function flushNow() {
  if (queue.length === 0) return;
  const events = queue.splice(0, 50);
  try {
    await request('POST', '/analytics/event', events);
  } catch {
    // Failed events are dropped, so the user is never affected
  }
}

// track('event_name', { extra props })
// Event names should be snake_case
export function track(name, props = {}) {
  if (!name) return;
  queue.push({
    name,
    props: props && typeof props === 'object' ? props : {},
    platform: PLATFORM,
    appVersion: APP_VERSION,
  });
  if (queue.length >= FLUSH_THRESHOLD) {
    flushNow();
  } else {
    scheduleFlush();
  }
}

// Explicit flush — worth calling when the app goes to the background (optional)
export function flushAnalytics() {
  return flushNow();
}
