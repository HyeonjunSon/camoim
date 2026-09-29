const mongoose = require('mongoose');

// Weekly business view counts — powers the "trending this week" ranking
// $inc on the (businessId, week) document when a detail page opens. week looks like '2026-W28'
const businessWeeklyStatSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  week:       { type: String, required: true }, // 'YYYY-Www'
  views:      { type: Number, default: 0 },
}, { timestamps: true });

businessWeeklyStatSchema.index({ businessId: 1, week: 1 }, { unique: true });
// Top-of-week sort
businessWeeklyStatSchema.index({ week: 1, views: -1 });

// Current week key (approximate ISO week in UTC — a ranking does not need strict ISO-8601)
businessWeeklyStatSchema.statics.currentWeekKey = function () {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

module.exports = mongoose.model('BusinessWeeklyStat', businessWeeklyStatSchema);
