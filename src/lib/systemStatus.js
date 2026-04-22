// 서버 응답 코드에 따른 글로벌 상태 (점검/강제업데이트/차단/정지)
const listeners = new Set();
let current = null; // { code, message, minVersion? }

export function getSystemStatus() {
  return current;
}

export function setSystemStatus(status) {
  current = status;
  listeners.forEach((fn) => {
    try { fn(current); } catch {}
  });
}

export function clearSystemStatus() {
  setSystemStatus(null);
}

export function subscribeSystemStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 서버 응답 코드 → 글로벌 상태로 격상해야 하는지 판별
const BLOCKING_CODES = new Set([
  'MAINTENANCE',
  'UPDATE_REQUIRED',
  'IP_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BANNED',
]);

export function handleResponseCode(data) {
  if (data && data.code && BLOCKING_CODES.has(data.code)) {
    setSystemStatus({
      code: data.code,
      message: data.message || '',
      minVersion: data.minVersion,
      suspendedUntil: data.suspendedUntil,
    });
    return true;
  }
  return false;
}
