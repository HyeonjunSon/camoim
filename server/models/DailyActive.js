const mongoose = require('mongoose');

// 일일 활성 유저(DAU) 기록 — 유저가 하루에 한 번이라도 API를 쓰면 (userId, date) 1건
// 날짜는 토론토 기준 (유저 대부분이 동부 시간대)
const dailyActiveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:   { type: String, required: true }, // 'YYYY-MM-DD' (America/Toronto)
}, { timestamps: true });

dailyActiveSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyActiveSchema.index({ date: 1 });

// 토론토 기준 오늘 날짜 키 ('en-CA' 로케일 = YYYY-MM-DD 형식)
dailyActiveSchema.statics.todayKey = function () {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
};

// 방문 기록 (fire-and-forget) — 같은 유저·같은 날은 메모리 캐시로 스킵해 DB 부하 최소화
const seen = new Map(); // userId → dateKey
dailyActiveSchema.statics.track = function (userId) {
  if (!userId) return;
  const key = this.todayKey();
  if (seen.get(String(userId)) === key) return; // 오늘 이미 기록함
  seen.set(String(userId), key);
  if (seen.size > 20000) seen.clear(); // 메모리 상한 (자정 넘으면 자연히 다시 기록됨)
  this.updateOne(
    { userId, date: key },
    { $setOnInsert: { userId, date: key } },
    { upsert: true }
  ).catch(() => { seen.delete(String(userId)); }); // 실패 시 다음 요청에서 재시도
};

module.exports = mongoose.model('DailyActive', dailyActiveSchema);
