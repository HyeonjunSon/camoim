const mongoose = require('mongoose');

// In-house event tracking for user behaviour — no third-party SDK, so it can ship over OTA
// e.g. search_submit, board_subscribe, post_share, post_create
const analyticsEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, index: true }, // Event name (snake_case)
  props: { type: mongoose.Schema.Types.Mixed, default: {} }, // Free-form properties
  platform: { type: String, enum: ['ios', 'android', 'web', null], default: null },
  appVersion: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

// For time-bucketed and per-event aggregation queries
analyticsEventSchema.index({ name: 1, createdAt: -1 });
// Auto-deleted after 30 days (TTL) — keeps storage cost down
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
