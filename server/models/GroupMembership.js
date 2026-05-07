const mongoose = require('mongoose');

// 모임 멤버십 — 한 사용자의 한 모임 가입 정보
const groupMembershipSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: {
    type: String,
    enum: ['owner', 'manager', 'member'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'banned'],
    default: 'active',
    index: true,
  },
  // 알림 설정 (모임 별)
  notifyPosts: { type: Boolean, default: false }, // 새 글 알림 (기본 OFF)
  notifyChat: { type: Boolean, default: true },   // 채팅 알림 (기본 ON)
  joinedAt: { type: Date, default: Date.now },
  bannedReason: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

// 한 사용자가 한 모임에 한 번만 가입
groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });
// 본인 가입 모임 빠른 조회
groupMembershipSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('GroupMembership', groupMembershipSchema);
