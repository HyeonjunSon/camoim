const SystemSetting = require('../models/SystemSetting');

// 5초마다 갱신하는 설정 캐시 (요청마다 DB 조회 부담 제거)
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
    // 캐시 유지
  }
  return cache.data;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}

// 버전 비교 (1.2.3 형식)
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

// 모든 요청 앞단에서 점검모드/IP차단/강제업데이트 체크
async function systemGuard(req, res, next) {
  // admin 라우트와 헬스체크는 항상 통과
  if (req.path.startsWith('/api/admin') || req.path === '/health') return next();

  const settings = await getSettings();

  // IP 차단
  const ip = clientIp(req);
  if (ip && settings.blockedIps.includes(ip)) {
    return res.status(403).json({ success: false, message: '접근이 차단되었습니다', code: 'IP_BLOCKED' });
  }

  // 강제 업데이트
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

  // 점검모드 — 인증 라우트는 통과 (관리자 로그인 가능해야 함)
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

// 게시글/댓글 본문에 금지어가 포함되었는지 검사
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

// 캐시 강제 무효화 (설정 변경 직후)
function invalidate() {
  cache.at = 0;
}

module.exports = { systemGuard, containsBannedWord, invalidate };
