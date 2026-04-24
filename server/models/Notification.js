const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // 'comment', 'like'
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  postId: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, default: null }, // 채팅 알림용
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// 알림 목록/미읽음 카운트 핫 쿼리
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
