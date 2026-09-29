const AdminLog = require('../models/AdminLog');

// Fire-and-forget logging helper
function logAdmin(req, action, { targetType = '', targetId = '', meta = {} } = {}) {
  AdminLog.create({
    adminId: req.user?.id,
    adminName: req.user?.nickname || '',
    action,
    targetType,
    targetId: String(targetId || ''),
    meta,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
  }).catch((e) => console.error('AdminLog 실패:', e.message));
}

module.exports = { logAdmin };
