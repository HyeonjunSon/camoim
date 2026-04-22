const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
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
  pinned:     { type: Boolean, default: false }, // 게시판 상단 고정
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
