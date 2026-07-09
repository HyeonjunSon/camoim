const mongoose = require('mongoose');

// 업체 주간 조회수 — "이번 주 인기 TOP" 랭킹용
// 상세 조회 시 (businessId, week) 문서에 $inc. week 예: '2026-W28'
const businessWeeklyStatSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  week:       { type: String, required: true }, // 'YYYY-Www'
  views:      { type: Number, default: 0 },
}, { timestamps: true });

businessWeeklyStatSchema.index({ businessId: 1, week: 1 }, { unique: true });
// 이번 주 상위 정렬
businessWeeklyStatSchema.index({ week: 1, views: -1 });

// 현재 주 키 (UTC 기준 ISO 주차 근사 — 랭킹 용도라 엄밀한 ISO-8601일 필요 없음)
businessWeeklyStatSchema.statics.currentWeekKey = function () {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

module.exports = mongoose.model('BusinessWeeklyStat', businessWeeklyStatSchema);
