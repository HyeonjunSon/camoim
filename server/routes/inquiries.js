const express = require('express');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { sendPush } = require('../utils/push');

const router = express.Router();

// POST /api/inquiries — 사용자 문의 작성
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      category, title, content,
      appVersion = '', platform = '', osVersion = '', deviceModel = '',
    } = req.body;

    if (!category || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, message: '카테고리, 제목, 내용을 입력해주세요.' });
    }
    if (!Inquiry.CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '잘못된 카테고리입니다.' });
    }

    // 도배 방지: 미답변 문의 5개 이상 차단
    const openCount = await Inquiry.countDocuments({
      userId: req.user.id,
      status: 'open',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (openCount >= 5) {
      return res.status(429).json({
        success: false,
        message: '최근 24시간 내 미답변 문의가 너무 많아요. 답변을 기다려주세요.',
      });
    }

    const inquiry = await Inquiry.create({
      userId: req.user.id,
      category,
      title: title.trim(),
      content: content.trim(),
      appVersion, platform, osVersion, deviceModel,
    });

    res.status(201).json({
      success: true,
      data: { id: inquiry._id, category: inquiry.category, title: inquiry.title, status: inquiry.status, createdAt: inquiry.createdAt },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/inquiries/me — 내 문의 목록
router.get('/me', requireAuth, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    const data = inquiries.map(i => ({
      id: i._id,
      category: i.category,
      title: i.title,
      status: i.status,
      hasAnswer: !!i.answer,
      createdAt: i.createdAt,
      answeredAt: i.answeredAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/inquiries/me/:id — 내 문의 상세
router.get('/me/:id', requireAuth, async (req, res) => {
  try {
    const i = await Inquiry.findById(req.params.id);
    if (!i) return res.status(404).json({ success: false, message: '문의를 찾을 수 없어요.' });
    if (String(i.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    res.json({
      success: true,
      data: {
        id: i._id,
        category: i.category,
        title: i.title,
        content: i.content,
        status: i.status,
        answer: i.answer,
        answeredAt: i.answeredAt,
        createdAt: i.createdAt,
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 관리자 전용 ───

// GET /api/inquiries/admin?type=ad|general&status=open|answered
router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type === 'ad') filter.category = 'ad';
    else if (type === 'general') filter.category = { $ne: 'ad' };
    if (status === 'open' || status === 'answered') filter.status = status;

    const inquiries = await Inquiry.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .populate('userId', 'nickname email');

    const data = inquiries.map(i => ({
      id: i._id,
      category: i.category,
      title: i.title,
      content: i.content,
      status: i.status,
      answer: i.answer,
      answeredAt: i.answeredAt,
      createdAt: i.createdAt,
      user: i.userId ? { id: i.userId._id, nickname: i.userId.nickname, email: i.userId.email } : null,
      appVersion: i.appVersion,
      platform: i.platform,
      osVersion: i.osVersion,
      deviceModel: i.deviceModel,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/inquiries/admin/:id/answer — 답변 작성 + 푸시
router.put('/admin/:id/answer', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer?.trim()) {
      return res.status(400).json({ success: false, message: '답변 내용을 입력해주세요.' });
    }
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ success: false, message: '문의를 찾을 수 없어요.' });

    inquiry.answer = answer.trim();
    inquiry.status = 'answered';
    inquiry.answeredBy = req.user.id;
    inquiry.answeredAt = new Date();
    await inquiry.save();

    // 사용자 푸시 알림
    User.findById(inquiry.userId).select('pushToken notificationSettings').lean()
      .then((u) => {
        if (!u?.pushToken) return;
        if (u.notificationSettings?.enabled === false) return;
        sendPush(
          u.pushToken,
          '📩 문의에 답변이 도착했어요',
          inquiry.title.slice(0, 60),
          { type: 'inquiry', inquiryId: String(inquiry._id) },
          inquiry.userId,
        );
      })
      .catch(() => {});

    res.json({ success: true, data: { id: inquiry._id, status: inquiry.status, answer: inquiry.answer, answeredAt: inquiry.answeredAt } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
