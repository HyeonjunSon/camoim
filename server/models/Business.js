const mongoose = require('mongoose');

// 한인 업체 (지도) — 유저 제보 + 관리자 등록, 승인 후 지도 노출
// Google Places 자동 수집은 1.0.x에서 보류 (source enum에 'google'은 향후용으로 남김)
const CATEGORIES = ['food', 'cafe', 'mart', 'hair', 'clinic', 'realty', 'etc'];
const CITIES = ['toronto', 'vancouver', 'montreal'];

const businessSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  category:    { type: String, enum: CATEGORIES, required: true, index: true },
  city:        { type: String, required: true, index: true },
  address:     { type: String, required: true, trim: true, maxlength: 200 },
  phone:       { type: String, default: '', trim: true, maxlength: 40 },
  hours:       { type: String, default: '', trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  images:      { type: [String], default: [] },

  // GeoJSON Point — [lng, lat]. 지오코딩 실패 시 미설정(지도 핀 제외, 리스트엔 노출)
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },

  source:   { type: String, enum: ['google', 'admin', 'user'], default: 'user', index: true },
  status:   { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

  submittedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submitterNickname: { type: String, default: '' }, // 제보 시점 스냅샷
  sourceName: { type: String, default: '' }, // 출처 표기 (예: 캐나다 한국일보) — 제휴 데이터 attribution

  bookmarkCount: { type: Number, default: 0 },
  reportCount:   { type: Number, default: 0 },
  // 리뷰 집계 (BusinessReview 비정규화 — 목록/지도에서 join 없이 별점 표시)
  ratingAvg:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  rejectedReason: { type: String, default: '' },
}, { timestamps: true });

// 지리 검색용 (location 없는 문서는 자동 제외)
businessSchema.index({ location: '2dsphere' });
// 지도 목록 필터 조합
businessSchema.index({ city: 1, status: 1, category: 1 });

businessSchema.statics.CATEGORIES = CATEGORIES;
businessSchema.statics.CITIES = CITIES;

module.exports = mongoose.model('Business', businessSchema);
