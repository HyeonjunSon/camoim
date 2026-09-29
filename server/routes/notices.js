const express = require('express');
const Notice = require('../models/Notice');
const User = require('../models/User');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { sendPush } = require('../utils/push');

const router = express.Router();

// GET /api/notices — announcement list (public)
// populate would add a second serial query for the author, so $lookup keeps it to one DB round trip
router.get('/', async (req, res) => {
  try {
    const notices = await Notice.aggregate([
      { $sort: { pinned: -1, createdAt: -1 } },
      { $lookup: {
        from: 'users',
        let: { uid: '$authorId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
          { $project: { nickname: 1 } },
        ],
        as: 'author',
      } },
    ]);
    const data = notices.map(n => ({
      id: n._id,
      title: n.title,
      content: n.content,
      pinned: n.pinned,
      author: n.author?.[0]?.nickname,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/notices/:id
router.get('/:id', async (req, res) => {
  try {
    const n = await Notice.findById(req.params.id).populate('authorId', 'nickname');
    if (!n) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    res.json({
      success: true,
      data: {
        id: n._id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        author: n.authorId?.nickname,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/notices — create an announcement (admin)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, pinned = false, sendPush: doPush = false } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, message: '제목과 내용을 입력해주세요.' });
    }
    const notice = await Notice.create({
      title: title.trim(),
      content: content.trim(),
      pinned: !!pinned,
      authorId: req.user.id,
    });

    // Bulk push, fire-and-forget
    if (doPush) {
      User.find({
        pushToken: { $ne: '' },
        $or: [
          { 'notificationSettings.notice': { $ne: false } },
          { 'notificationSettings.notice': { $exists: false } },
        ],
      })
        .select('pushToken notificationSettings')
        .lean()
        .then((users) => {
          for (const u of users) {
            if (u.notificationSettings?.enabled === false) continue;
            if (u.notificationSettings?.notice === false) continue;
            sendPush(
              u.pushToken,
              '📢 ' + notice.title,
              notice.content.slice(0, 80),
              { type: 'notice', noticeId: String(notice._id) },
              u._id,
            );
          }
        })
        .catch((e) => console.error('공지 푸시 발송 실패:', e.message));
    }

    res.status(201).json({
      success: true,
      data: { id: notice._id, title: notice.title, content: notice.content, pinned: notice.pinned, createdAt: notice.createdAt },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/notices/:id (admin)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, pinned } = req.body;
    const update = {};
    if (title !== undefined) update.title = String(title).trim();
    if (content !== undefined) update.content = String(content).trim();
    if (pinned !== undefined) update.pinned = !!pinned;
    const n = await Notice.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!n) return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
    res.json({ success: true, data: { id: n._id, title: n.title, content: n.content, pinned: n.pinned } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/notices/:id (admin)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
