// 자체 이벤트 트래킹 — 외부 SDK 없이 우리 서버에 직접 전송
// 배치: 이벤트를 큐에 모아 5초마다 또는 큐 길이 10개 이상일 때 flush
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
    // 실패한 이벤트는 버림 — 사용자 경험에 영향 없도록
  }
}

// track('event_name', { extra props })
// 이벤트 이름은 snake_case 권장
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

// 명시적 flush — 앱 백그라운드 진입 시 호출 권장 (선택)
export function flushAnalytics() {
  return flushNow();
}
