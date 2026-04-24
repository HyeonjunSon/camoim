const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isAnonymousAllowed: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  university: { type: String, default: '' }, // 빈 문자열 = 전체 공개, 값 있으면 해당 학교만
  isUniversityBoard: { type: Boolean, default: false },
});

// 학교 게시판 필터/정렬 핫 쿼리
boardSchema.index({ isUniversityBoard: 1, sortOrder: 1 });
boardSchema.index({ university: 1 });

module.exports = mongoose.model('Board', boardSchema);
