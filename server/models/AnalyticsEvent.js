const mongoose = require('mongoose');

// 자체 이벤트 트래킹 — 사용자 행동 분석용 (외부 SDK 없음, OTA로 추가 가능)
// 예: search_submit, board_subscribe, post_share, post_create 등
const analyticsEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, index: true }, // 이벤트명 (snake_case)
  props: { type: mongoose.Schema.Types.Mixed, default: {} }, // 자유 속성
  platform: { type: String, enum: ['ios', 'android', 'web', null], default: null },
  appVersion: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

// 시간 + 이벤트별 집계 쿼리용
analyticsEventSchema.index({ name: 1, createdAt: -1 });
// 30일 후 자동 삭제 (TTL) — 저장 비용 관리
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
