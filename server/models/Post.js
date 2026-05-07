const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  // 모임 게시판 글이면 채워짐. 일반 게시판은 null.
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  images: [{ type: String }], // 첨부 이미지 URL 목록 (최대 4개)
  city: { type: String, default: '', index: true }, // 작성자 도시 (유저 프로필에서 자동 복사)
  // 관리자 모더레이션
  hidden:     { type: Boolean, default: false, index: true }, // 관리자가 숨김 처리
  hiddenReason: { type: String, default: '' },
  // 자동 숨김 (신고 누적)
  autoHidden:   { type: Boolean, default: false, index: true },
  reportCount:  { type: Number, default: 0 },
  pinned:     { type: Boolean, default: false }, // 게시판 상단 고정
}, { timestamps: true });

// 핫 쿼리용 복합 인덱스 — 게시판 목록/내 글/홈 피드 전부 이 인덱스로 빨라짐
postSchema.index({ boardId: 1, createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likedBy: 1 });

module.exports = mongoose.model('Post', postSchema);
