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

module.exports = mongoose.model('Board', boardSchema);
