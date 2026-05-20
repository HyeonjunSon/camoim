const mongoose = require('mongoose');

// 글쓰기 임시저장
// CreatePostScreen에서 사용자가 작성 중이던 내용을 보관 → 햄버거 버튼으로 불러오기
// boardId 또는 groupId 중 하나만 채워짐 (둘 다 비어있어도 OK — 보드 안 정해진 단계의 초안)
const draftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  title:   { type: String, default: '', maxlength: 500 },
  content: { type: String, default: '' }, // HTML or plain
  isAnonymous: { type: Boolean, default: false },
  images: [{ type: String, maxlength: 500 }],
  city:    { type: String, default: '', maxlength: 100 },
  tradeStatus: { type: String, enum: ['selling', 'sold'], default: 'selling' },
}, { timestamps: true });

// 본인 드래프트 목록 최신순
draftSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Draft', draftSchema);
