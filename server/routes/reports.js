const express = require('express');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REASON_LABELS = {
  spam: '스팸/도배',
  hate: '욕설/혐오',
  illegal: '불법정보',
  adult: '음란물',
  etc: '기타',
};

// Auto-hide once N reports accumulate (per Apple UGC guideline 1.2)
const AUTO_HIDE_THRESHOLD = 3;

async function maybeAutoHide(targetType, targetId) {
  const count = await Report.countDocuments({ targetId, status: { $ne: 'dismissed' } });
  if (count < AUTO_HIDE_THRESHOLD) {
    if (targetType === 'post') await Post.updateOne({ _id: targetId }, { $set: { reportCount: count } });
    else if (targetType === 'comment') await Comment.updateOne({ _id: targetId }, { $set: { reportCount: count } });
    return false;
  }
  if (targetType === 'post') {
    await Post.updateOne({ _id: targetId }, { $set: { autoHidden: true, reportCount: count } });
  } else if (targetType === 'comment') {
    await Comment.updateOne({ _id: targetId }, { $set: { autoHidden: true, reportCount: count } });
  }
  // User reports follow a separate workflow with admin review — auto-blocking would be risky
  return true;
}

// POST /api/reports — report a post or a comment
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

    // Snapshot the author at report time, so an admin can still tell who wrote it after the account is deleted
    let targetAuthorId = null;
    let targetAuthorNickname = '';
    let targetIsAnonymous = false;
    try {
      if (targetType === 'post') {
        const post = await Post.findById(targetId).select('userId isAnonymous').lean();
        if (post) {
          targetAuthorId = post.userId || null;
          targetIsAnonymous = !!post.isAnonymous;
        }
      } else if (targetType === 'comment') {
        const comment = await Comment.findById(targetId).select('userId isAnonymous').lean();
        if (comment) {
          targetAuthorId = comment.userId || null;
          targetIsAnonymous = !!comment.isAnonymous;
        }
      } else if (targetType === 'user') {
        targetAuthorId = targetId;
      }
      if (targetAuthorId) {
        const u = await User.findById(targetAuthorId).select('nickname').lean();
        if (u) targetAuthorNickname = u.nickname || '';
      }
    } catch (snapErr) {
      console.error('[reports] author snapshot failed:', snapErr);
    }

    await Report.create({
      reporterId: req.user.id,
      targetType,
      targetId,
      postId: postId || null,
      targetAuthorId,
      targetAuthorNickname,
      targetIsAnonymous,
      reason,
      detail: String(detail || '').slice(0, 1000).trim(),
    });

    // Auto-hide trigger
    try {
      await maybeAutoHide(targetType, targetId);
    } catch (hideErr) {
      console.error('[reports] auto-hide failed:', hideErr);
    }

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
