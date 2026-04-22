const express = require('express');
const Report = require('../models/Report');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REASON_LABELS = {
  spam: '스팸/도배',
  hate: '욕설/혐오',
  illegal: '불법정보',
  adult: '음란물',
  etc: '기타',
};

// POST /api/reports — 게시글 또는 댓글 신고
router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, postId, reason, detail } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ success: false, message: '신고 정보가 올바르지 않습니다.' });
    }

    if (!['post', 'comment', 'user'].includes(targetType)) {
      return res.status(400).json({ success: false, message: '잘못된 신고 유형입니다.' });
    }

    if (!Object.keys(REASON_LABELS).includes(reason)) {
      return res.status(400).json({ success: false, message: '올바른 신고 사유를 선택해주세요.' });
    }

    if (targetType === 'user' && String(targetId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '자기 자신을 신고할 수 없습니다.' });
    }

    const existing = await Report.findOne({ reporterId: req.user.id, targetId });
    if (existing) {
      return res.status(409).json({ success: false, message: '이미 신고한 대상입니다.' });
    }

    await Report.create({
      reporterId: req.user.id,
      targetType,
      targetId,
      postId: postId || null,
      reason,
      detail: detail?.trim() || '',
    });

    res.status(201).json({ success: true, data: { message: '신고가 접수됐어요. 검토 후 조치할게요.' } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: '이미 신고한 게시글입니다.' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
