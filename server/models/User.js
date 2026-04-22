const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  nickname: { type: String, required: true, unique: true, maxlength: 100 },
  location: { type: String, default: '' },
  school: { type: String, default: '' },
  bio: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  role: {
    type: String,
    enum: ['admin', 'student', 'working_holiday', 'general'],
    default: 'general',
  },
  verified: {
    type: Boolean,
    default: false,
  },
  university: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerifyCode: { type: String, default: '' },
  emailVerifyExpires: { type: Date, default: null },
  pushToken: {
    type: String,
    default: '',
  },
  // 계정 상태 — 관리자 제재용
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'deleted'],
    default: 'active',
    index: true,
  },
  suspendedUntil: { type: Date, default: null }, // null이고 status=suspended면 무기한
  suspendReason:  { type: String, default: '' },
  warningCount:   { type: Number, default: 0 },
  shadowBanned:   { type: Boolean, default: false }, // 본인은 모르고 글이 다른 사람에게 안 보임
  notificationSettings: {
    enabled:    { type: Boolean, default: true }, // 마스터
    comment:    { type: Boolean, default: true }, // 내 글에 댓글
    reply:      { type: Boolean, default: true }, // 내 댓글에 답글
    like:       { type: Boolean, default: true }, // 좋아요
    chat:       { type: Boolean, default: true }, // 채팅 메시지
    notice:     { type: Boolean, default: true }, // 공지사항
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
