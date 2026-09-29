// Global state driven by server response codes (maintenance, forced update, blocked, suspended)
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

// Decides whether a server response code should escalate to global state
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
