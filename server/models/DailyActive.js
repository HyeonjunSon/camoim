const mongoose = require('mongoose');

// Daily active users — one (userId, date) record per user per day they touch the API
// Dates are Toronto-based (most users are in the Eastern time zone)
const dailyActiveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:   { type: String, required: true }, // 'YYYY-MM-DD' (America/Toronto)
}, { timestamps: true });

dailyActiveSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyActiveSchema.index({ date: 1 });

// Today's date key in Toronto (the 'en-CA' locale yields YYYY-MM-DD)
dailyActiveSchema.statics.todayKey = function () {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
};

// Record a visit, fire-and-forget — an in-memory cache skips repeats for the same user and day to spare the DB
const seen = new Map(); // userId → dateKey
dailyActiveSchema.statics.track = function (userId) {
  if (!userId) return;
  const key = this.todayKey();
  if (seen.get(String(userId)) === key) return; // Already recorded today
  seen.set(String(userId), key);
  if (seen.size > 20000) seen.clear(); // Memory ceiling (the cache naturally starts recording again past midnight)
  this.updateOne(
    { userId, date: key },
    { $setOnInsert: { userId, date: key } },
    { upsert: true }
  ).catch(() => { seen.delete(String(userId)); }); // On failure, retry on the next request
};

module.exports = mongoose.model('DailyActive', dailyActiveSchema);
