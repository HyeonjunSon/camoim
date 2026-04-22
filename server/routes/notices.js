const express = require('express');
const Notice = require('../models/Notice');
const User = require('../models/User');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { sendPush } = require('../utils/push');

const router = express.Router();

// GET /api/notices — 공지 목록 (공개)
router.get('/', async (req, res) => {
  try {
    const notices = await Notice.find()
      .sort({ pinned: -1, createdAt: -1 })
      .populate('authorId', 'nickname');
    const data = notices.map(n => ({
      id: n._id,
      title: n.title,
      content: n.content,
      pinned: n.pinned,
      author: n.authorId?.nickname,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
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
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/notices — 공지 작성 (관리자)
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

    // 푸시 일괄 발송 (fire-and-forget)
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
              { type: 'notice', noticeId: String(notice._id) }
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
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/notices/:id (관리자)
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
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/notices/:id (관리자)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
