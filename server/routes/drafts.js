// 글쓰기 임시저장 (드래프트)
// - GET /api/drafts — 내 드래프트 최신순 (최대 20개)
// - POST /api/drafts — 새 드래프트 저장
// - PUT /api/drafts/:id — 본인 드래프트 수정 (auto-save)
// - DELETE /api/drafts/:id — 본인 드래프트 삭제
const express = require('express');
const Draft = require('../models/Draft');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_DRAFTS_PER_USER = 20;

const PICK_FIELDS = ['boardId', 'groupId', 'title', 'content', 'isAnonymous', 'images', 'city', 'tradeStatus'];

function pickPatch(body) {
  const patch = {};
  for (const k of PICK_FIELDS) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  if (typeof patch.title === 'string') patch.title = patch.title.slice(0, 500);
  if (Array.isArray(patch.images)) patch.images = patch.images.slice(0, 10);
  return patch;
}

// GET /api/drafts
router.get('/', async (req, res) => {
  try {
    const list = await Draft.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(MAX_DRAFTS_PER_USER)
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// POST /api/drafts
// 최대 개수 초과 시 가장 오래된 것 자동 삭제 (FIFO)
router.post('/', async (req, res) => {
  try {
    const patch = pickPatch(req.body);
    if (!patch.title?.trim() && !patch.content?.trim()) {
      return res.status(400).json({ success: false, message: '제목 또는 내용 중 하나는 있어야 해요.' });
    }
    const draft = await Draft.create({ ...patch, userId: req.user.id });

    // 정원 초과 정리
    const count = await Draft.countDocuments({ userId: req.user.id });
    if (count > MAX_DRAFTS_PER_USER) {
      const overflow = count - MAX_DRAFTS_PER_USER;
      const olds = await Draft.find({ userId: req.user.id })
        .sort({ updatedAt: 1 })
        .limit(overflow)
        .select('_id')
        .lean();
      if (olds.length) {
        await Draft.deleteMany({ _id: { $in: olds.map(o => o._id) } });
      }
    }

    res.json({ success: true, data: draft });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/drafts/:id
router.put('/:id', async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: '드래프트를 찾을 수 없어요.' });
    if (String(draft.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '본인 드래프트만 수정할 수 있어요.' });
    }
    const patch = pickPatch(req.body);
    await Draft.findByIdAndUpdate(draft._id, { $set: patch });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/drafts/:id
router.delete('/:id', async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: '드래프트를 찾을 수 없어요.' });
    if (String(draft.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '본인 드래프트만 삭제할 수 있어요.' });
    }
    await draft.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
