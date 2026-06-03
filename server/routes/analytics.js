const express = require('express');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/event { name, props?, platform?, appVersion? }
// 이벤트 단일 또는 배열 둘 다 받음. 배치 전송 권장.
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const events = Array.isArray(req.body) ? req.body : [req.body];

    const docs = events
      .filter(e => e && typeof e.name === 'string' && e.name.length <= 60)
      .slice(0, 50) // 한 번에 최대 50개
      .map(e => ({
        userId,
        name: e.name,
        props: e.props && typeof e.props === 'object' ? e.props : {},
        platform: ['ios', 'android', 'web'].includes(e.platform) ? e.platform : null,
        appVersion: typeof e.appVersion === 'string' ? e.appVersion.slice(0, 20) : '',
      }));

    if (docs.length > 0) {
      AnalyticsEvent.insertMany(docs, { ordered: false }).catch(() => {});
    }

    res.json({ success: true, data: { received: docs.length } });
  } catch (err) {
    // 분석 데이터 손실은 사용자 경험에 영향 없도록 silent
    res.json({ success: true, data: { received: 0 } });
  }
});

module.exports = router;
