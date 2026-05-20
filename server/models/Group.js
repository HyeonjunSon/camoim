const mongoose = require('mongoose');

// community: 그룹장이 직접 꾸미는 소셜 링크 + 공지 (학교 커뮤니티 카드와 동일 패턴)
const communitySchema = new mongoose.Schema({
  instagram: { type: String, default: '', maxlength: 300 },
  kakaoOpen: { type: String, default: '', maxlength: 300 },
  discord:   { type: String, default: '', maxlength: 300 },
  homepage:  { type: String, default: '', maxlength: 300 },
  notice:    { type: String, default: '', maxlength: 500 },
}, { _id: false });

// 사용자가 만드는 주제별 모임 (그룹)
// admin 승인 후 활성화됨. 활성화되면 게시판 + 그룹 채팅이 자동으로 묶여서 운영됨.
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, default: '', maxlength: 500 },
  coverImage: { type: String, default: '', maxlength: 500 }, // Cloudinary URL
  category: {
    type: String,
    enum: ['hobby', 'study', 'local', 'job', 'workinghol', 'general'],
    default: 'general',
    index: true,
  },
  city: { type: String, default: '', maxlength: 100, index: true }, // 지역 모임이면
  // 학교 한정 동아리: 빈 문자열 = 누구나 가입, 값 있으면 인증된 해당 학교 회원만
  university: { type: String, default: '', maxlength: 100, index: true },

  // 그룹장 + 부그룹장
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  managerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // 캐시 카운트
  memberCount: { type: Number, default: 1 },
  postCount: { type: Number, default: 0 },

  // 가입 정책
  joinPolicy: { type: String, enum: ['open', 'approval'], default: 'open' },
  maxMembers: { type: Number, default: 500 },

  // Admin 승인 워크플로
  status: {
    type: String,
    enum: ['pending_review', 'active', 'rejected', 'closed'],
    default: 'pending_review',
    index: true,
  },
  rejectReason: { type: String, default: '', maxlength: 500 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },

  // 그룹장(또는 부그룹장)이 꾸미는 소셜·공지 카드
  community: { type: communitySchema, default: () => ({}) },
}, { timestamps: true });

groupSchema.index({ status: 1, category: 1, createdAt: -1 });
groupSchema.index({ status: 1, memberCount: -1 });
groupSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Group', groupSchema);
