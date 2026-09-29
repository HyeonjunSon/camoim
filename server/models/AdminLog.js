const mongoose = require('mongoose');

// Every admin action is recorded — audit log
const adminLogSchema = new mongoose.Schema({
  adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adminName:  { type: String, default: '' },
  action:     { type: String, required: true, index: true }, // ex) 'user.suspend', 'post.delete'
  targetType: { type: String, default: '' }, // 'user' | 'post' | 'comment' | 'board' | 'system'
  targetId:   { type: String, default: '' },
  meta:       { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:         { type: String, default: '' },
}, { timestamps: true });

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
