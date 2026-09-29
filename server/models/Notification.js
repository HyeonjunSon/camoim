const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // 'comment', 'like'
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  postId: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, default: null }, // For chat notifications
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// Hot query: notification list and unread count
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
