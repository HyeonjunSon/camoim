// JWT authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DailyActive = require('../models/DailyActive');

const requireAuth = async (req, res, next) => {
  // Pull the Bearer token out of the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT, then attach the user to req.user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email, nickname: decoded.nickname };
    // Reject suspended/deleted accounts and check tokenVersion
    try {
      const u = await User.findById(decoded.id).select('status suspendedUntil suspendReason role tokenVersion').lean();
      if (!u) return res.status(401).json({ success: false, message: '계정을 찾을 수 없습니다.' });
      // A password change or reset bumps tokenVersion, invalidating every older token
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
          // Auto-release
          await User.findByIdAndUpdate(decoded.id, { status: 'active', suspendedUntil: null });
        }
      }
      req.user.role = u.role;
    } catch (e) {
      // A failed lookup passes through (a transient DB fault should not take the service down)
    }
    DailyActive.track(decoded.id); // Record the daily visit (fire-and-forget, once per day)
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
};

// Optional auth — sets req.user when a token is present, passes through when it is not
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.email, nickname: decoded.nickname };
      DailyActive.track(decoded.id); // Record the daily visit
    } catch (err) {
      // Invalid token — continue unauthenticated
    }
  }
  next();
};

module.exports = { requireAuth, optionalAuth };
