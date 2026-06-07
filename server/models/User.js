const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, maxlength: 200 },
  // 소셜 가입자는 비밀번호 없을 수 있음 (Apple/Google 로그인)
  passwordHash: { type: String, default: null },
  // 소셜 로그인 식별자 (auto-link by email)
  appleSub:  { type: String, default: null, sparse: true, index: true },
  googleSub: { type: String, default: null, sparse: true, index: true },
  nickname: { type: String, required: true, unique: true, maxlength: 30 },
  location: { type: String, default: '', maxlength: 100 },
  school: { type: String, default: '', maxlength: 200 },
  bio: { type: String, default: '', maxlength: 500 },
  avatarUrl: { type: String, default: '', maxlength: 500 },
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
    maxlength: 200,
  },
  city: {
    type: String,
    default: '',
    maxlength: 100,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerifyCode: { type: String, default: '' },
  emailVerifyExpires: { type: Date, default: null },
  resetCode: { type: String, default: '' },
  resetExpires: { type: Date, default: null },
  // 로그인 잠금 (brute-force 방어)
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  // JWT 무효화용 — 비번 변경/리셋 시 증가시키면 기존 토큰 모두 만료
  tokenVersion: { type: Number, default: 0 },
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
  suspendReason:  { type: String, default: '', maxlength: 500 },
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

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
