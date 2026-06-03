const mongoose = require('mongoose');

// 게시판 새 글 알림 구독 — 사용자가 특정 게시판에 새 글 올라오면 알림 받기
const boardSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
}, { timestamps: true });

boardSubscriptionSchema.index({ userId: 1, boardId: 1 }, { unique: true });

module.exports = mongoose.model('BoardSubscription', boardSubscriptionSchema);
