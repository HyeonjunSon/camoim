const mongoose = require('mongoose');

// 숙소 즐겨찾기 — BusinessBookmark와 동일 패턴 (별도 컬렉션으로 유니크 인덱스 분리)
const stayBookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stayId: { type: mongoose.Schema.Types.ObjectId, ref: 'StayListing', required: true, index: true },
}, { timestamps: true });

stayBookmarkSchema.index({ userId: 1, stayId: 1 }, { unique: true });

module.exports = mongoose.model('StayBookmark', stayBookmarkSchema);
