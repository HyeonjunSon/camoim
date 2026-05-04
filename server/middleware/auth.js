// JWT 인증 미들웨어
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // JWT 검증 후 req.user에 유저 정보 첨부
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email, nickname: decoded.nickname };
    // 정지/탈퇴 계정 차단 + tokenVersion 검증
    try {
      const u = await User.findById(decoded.id).select('status suspendedUntil suspendReason role tokenVersion').lean();
      if (!u) return res.status(401).json({ success: false, message: '계정을 찾을 수 없습니다.' });
      // 비번 변경/리셋으로 tokenVersion이 바뀌었으면 기존 토큰 무효
      const tokenVer = decoded.v || 0;
      const userVer = u.tokenVersion || 0;
      if (tokenVer !== userVer) {
        return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Session expired. Please log in again.' });
      }
      if (u.status === 'banned' || u.status === 'deleted') {
        return res.status(403).json({ success: false, message: '이용이 정지된 계정입니다.', code: 'ACCOUNT_BANNED' });
      }
      if (u.status === 'suspended') {
        if (!u.suspendedUntil || new Date(u.suspendedUntil) > new Date()) {
          return res.status(403).json({
            success: false,
            message: `이용이 일시 정지되었습니다.\n사유: ${u.suspendReason || '약관 위반'}`,
            code: 'ACCOUNT_SUSPENDED',
            suspendedUntil: u.suspendedUntil,
          });
        } else {
          // 자동 해제
          await User.findByIdAndUpdate(decoded.id, { status: 'active', suspendedUntil: null });
        }
      }
      req.user.role = u.role;
    } catch (e) {
      // 조회 실패는 통과 (DB 일시 장애 시 서비스 중단 방지)
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
};

// 선택적 인증 미들웨어 — 토큰이 있으면 req.user 설정, 없어도 통과
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.email, nickname: decoded.nickname };
    } catch (err) {
      // 토큰 무효 — 비인증 상태로 통과
    }
  }
  next();
};

module.exports = { requireAuth, optionalAuth };
