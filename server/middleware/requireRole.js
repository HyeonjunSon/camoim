const { ROLES } = require('../constants/roles');
const User = require('../models/User');

// Middleware factory that admits only a given role or above
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      // Read the current role from the DB (the JWT copy can be stale)
      const user = await User.findById(req.user.id).select('role verified');
      if (!user) {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
      }
      // Reflect the fresh role back onto req.user
      req.user.role = user.role;
      req.user.verified = user.verified;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  };
}

// Admins only
const requireAdmin = requireRole(ROLES.ADMIN);

// Verified students only
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

// Any verified user, regardless of role (students, working holiday, general)
async function requireVerified(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('role verified');
    if (!user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    if (!user.verified) {
      return res.status(403).json({ success: false, message: '인증 회원만 이용할 수 있어요.' });
    }
    req.user.role = user.role;
    req.user.verified = user.verified;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { requireRole, requireAdmin, requireVerifiedStudent, requireVerified };
