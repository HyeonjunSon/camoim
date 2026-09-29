const express = require('express');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/event { name, props?, platform?, appVersion? }
// Accepts a single event or an array. Batching is preferred.
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const events = Array.isArray(req.body) ? req.body : [req.body];

    const docs = events
      .filter(e => e && typeof e.name === 'string' && e.name.length <= 60)
      .slice(0, 50) // At most 50 per call
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
    // Losing analytics data must never affect the user, so failures stay silent
    res.json({ success: true, data: { received: 0 } });
  }
});

module.exports = router;
