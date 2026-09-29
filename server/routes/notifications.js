const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Chat messages never appear in the notification list — the chat tab badge covers them (Option B)
const NOTIFICATION_FILTER = { type: { $nin: ['chat', 'group_chat'] } };

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id, isRead: false, ...NOTIFICATION_FILTER,
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id, ...NOTIFICATION_FILTER })
      .sort({ isRead: 1, createdAt: -1 })
      .limit(50);

    const formatted = notifications.map(n => ({
      id: n._id,
      type: n.type,
      message: n.message,
      isRead: n.isRead,
      postId: n.postId,
      roomId: n.roomId,
      createdAt: n.createdAt,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false, ...NOTIFICATION_FILTER },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
