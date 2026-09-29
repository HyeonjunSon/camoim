// Public stats — lightweight numbers shown to users (today's visitor count and the like)
const express = require('express');
const DailyActive = require('../models/DailyActive');
const User = require('../models/User');

const router = express.Router();

// 60s in-memory cache (so opening the home screen does not re-aggregate every time)
let cache = { key: '', count: 0, at: 0 };

// GET /api/stats/today-visitors — today's visitors (Toronto date), seed accounts excluded
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
