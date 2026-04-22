const { ROLES } = require('../constants/roles');
const User = require('../models/User');

// 특정 역할 이상만 허용하는 미들웨어 팩토리
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      // DB에서 최신 role 조회 (JWT 캐시 방지)
      const user = await User.findById(req.user.id).select('role verified');
      if (!user) {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
      }
      // req.user에 최신 role 반영
      req.user.role = user.role;
      req.user.verified = user.verified;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  };
}

// 관리자 전용
const requireAdmin = requireRole(ROLES.ADMIN);

// 인증된 학생 전용
async function requireVerifiedStudent(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('role verified');
    if (!user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    if (user.role !== ROLES.STUDENT || !user.verified) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });
    }
    req.user.role = user.role;
    req.user.verified = user.verified;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { requireRole, requireAdmin, requireVerifiedStudent };
