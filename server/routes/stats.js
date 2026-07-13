// 공개 통계 — 유저에게 보여주는 가벼운 지표 (오늘 방문자 수 등)
const express = require('express');
const DailyActive = require('../models/DailyActive');
const User = require('../models/User');

const router = express.Router();

// 60초 메모리 캐시 (홈 진입마다 집계 안 돌게)
let cache = { key: '', count: 0, at: 0 };

// GET /api/stats/today-visitors — 오늘(토론토 기준) 방문자 수, 시드 계정 제외
router.get('/today-visitors', async (req, res) => {
  try {
    const key = DailyActive.todayKey();
    if (cache.key === key && Date.now() - cache.at < 60_000) {
      return res.json({ success: true, count: cache.count });
    }
    const seedIds = (await User.find({ email: /^seed\d+@/ }).select('_id').lean()).map((u) => u._id);
    const count = await DailyActive.countDocuments({ date: key, userId: { $nin: seedIds } });
    cache = { key, count, at: Date.now() };
    res.json({ success: true, count });
  } catch (err) {
    console.error('GET /stats/today-visitors', err);
    res.status(500).json({ success: false, message: '통계를 불러오지 못했습니다.' });
  }
});

module.exports = router;
