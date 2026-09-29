const SystemSetting = require('../models/SystemSetting');

// Settings cache refreshed every 5s (keeps a DB read off every request)
let cache = { at: 0, data: { maintenance: { enabled: false, message: '' }, blockedIps: [], bannedWords: [], forceUpdate: { enabled: false, minVersion: '' } } };
const TTL = 5000;

async function getSettings() {
  if (Date.now() - cache.at < TTL) return cache.data;
  try {
    const all = await SystemSetting.find().lean();
    const map = {};
    all.forEach(s => { map[s.key] = s.value; });
    cache = {
      at: Date.now(),
      data: {
        maintenance: map.maintenance || { enabled: false, message: '' },
        blockedIps: map.blockedIps || [],
        bannedWords: map.bannedWords || [],
        forceUpdate: map.forceUpdate || { enabled: false, minVersion: '' },
      },
    };
  } catch (e) {
    // Cache still warm
  }
  return cache.data;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}

// Version comparison (1.2.3 form)
function versionLt(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

// Front-of-the-line check for maintenance mode, IP blocks and forced updates
async function systemGuard(req, res, next) {
  // Admin routes and the health check always pass
  if (req.path.startsWith('/api/admin') || req.path === '/health') return next();

  const settings = await getSettings();

  // IP block
  const ip = clientIp(req);
  if (ip && settings.blockedIps.includes(ip)) {
    return res.status(403).json({ success: false, message: '접근이 차단되었습니다', code: 'IP_BLOCKED' });
  }

  // Forced update
  if (settings.forceUpdate?.enabled) {
    const clientVersion = req.headers['x-app-version'];
    if (clientVersion && versionLt(clientVersion, settings.forceUpdate.minVersion)) {
      return res.status(426).json({
        success: false,
        message: '최신 버전으로 업데이트 해주세요',
        code: 'UPDATE_REQUIRED',
        minVersion: settings.forceUpdate.minVersion,
      });
    }
  }

  // Maintenance mode — auth routes still pass so an admin can log in
  if (settings.maintenance?.enabled) {
    if (req.path.startsWith('/api/auth/login')) return next();
    return res.status(503).json({
      success: false,
      message: settings.maintenance.message || '시스템 점검 중입니다',
      code: 'MAINTENANCE',
    });
  }

  next();
}

// Check post and comment bodies against the banned-word list
async function containsBannedWord(text) {
  if (!text) return null;
  const { bannedWords } = await getSettings();
  if (!bannedWords?.length) return null;
  const lower = String(text).toLowerCase();
  for (const w of bannedWords) {
    if (w && lower.includes(String(w).toLowerCase())) return w;
  }
  return null;
}

// Force the cache to drop (used right after a settings change)
function invalidate() {
  cache.at = 0;
}

module.exports = { systemGuard, containsBannedWord, invalidate };
