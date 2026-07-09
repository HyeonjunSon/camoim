const mongoose = require('mongoose');

// 업체 리뷰 — 별점(1~5) + 한줄평. 업체당 1인 1리뷰(수정 = upsert)
// 평균/개수는 Business.ratingAvg / ratingCount 에 비정규화 (목록·지도에서 join 없이 표시)
const businessReviewSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  text:       { type: String, default: '', trim: true, maxlength: 300 },
  nickname:   { type: String, default: '' }, // 작성 시점 스냅샷 (탈퇴해도 리뷰 유지)
}, { timestamps: true });

// 1인 1리뷰
businessReviewSchema.index({ businessId: 1, userId: 1 }, { unique: true });
// 최신순 목록
businessReviewSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('BusinessReview', businessReviewSchema);
