const mongoose = require('mongoose');

// 업체 즐겨찾기 — 게시글 Bookmark와 분리(스키마/유니크 인덱스 충돌 방지)
const businessBookmarkSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
}, { timestamps: true });

businessBookmarkSchema.index({ userId: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.model('BusinessBookmark', businessBookmarkSchema);
