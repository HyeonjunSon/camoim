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

module.exports = mongoose.model('Notification', notificationSchema);
