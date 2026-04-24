const express = require('express');
const mongoose = require('mongoose');
const VerifyRequest = require('../models/VerifyRequest');
const User = require('../models/User');
const Board = require('../models/Board');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AdminLog = require('../models/AdminLog');
const SystemSetting = require('../models/SystemSetting');
const { invalidate: invalidateSystemCache } = require('../middleware/systemGuard');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { logAdmin } = require('../utils/adminLog');

const router = express.Router();

// 모든 admin 라우트는 로그인 + 관리자 권한 필요
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/verify-requests?status=pending
router.get('/verify-requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const requests = await VerifyRequest.find({ status })
      .sort({ createdAt: 1 })
      .populate('userId', 'nickname email');

    const formatted = requests.map(r => ({
      id: r._id,
      userId: r.userId?._id,
      nickname: r.userId?.nickname,
      email: r.userId?.email,
      university: r.university,
      studentType: r.studentType,
      graduationYear: r.graduationYear,
      fileUrl: r.fileUrl,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/admin/verify-requests/:id/approve — 승인
router.put('/verify-requests/:id/approve', async (req, res) => {
  try {
    const request = await VerifyRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: '신청을 찾을 수 없습니다.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: '이미 처리된 신청입니다.' });
    }

    // 인증 상태 업데이트
    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    // 유저 role, verified, university 업데이트
    const updateData = {
      verified: true,
      university: request.university,
      role: request.studentType === 'alumni' ? 'general' : 'student',
    };
    await User.findByIdAndUpdate(request.userId, updateData);

    // 학교 게시판 자동 생성 (없으면)
    await ensureUniversityBoards(request.university);

    res.json({ success: true, data: { message: '승인 완료' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/admin/verify-requests/:id/reject — 거절
router.put('/verify-requests/:id/reject', async (req, res) => {
  try {
    const { adminNote } = req.body;
    const request = await VerifyRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: '신청을 찾을 수 없습니다.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: '이미 처리된 신청입니다.' });
    }

    request.status = 'rejected';
    request.adminNote = adminNote || '';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({ success: true, data: { message: '거절 완료' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 학교 게시판 4종 자동 생성 헬퍼
const UNIVERSITY_BOARD_TEMPLATES = [
  { slugSuffix: 'free',      name: '학교자유게시판',     description: '학교 친구들과 자유롭게 이야기해요',         isAnonymousAllowed: false, sortOrder: 1 },
  { slugSuffix: 'anonymous', name: '학교 익명',          description: '익명으로 털어놓아요',                       isAnonymousAllowed: true,  sortOrder: 2 },
  { slugSuffix: 'meetup',    name: '학교 한인 모임',     description: '밥약·스터디·운동·동아리 같이 할 사람 찾아요', isAnonymousAllowed: false, sortOrder: 3 },
  { slugSuffix: 'info',      name: '학교 유학생 정보',   description: '학교 생활·비자·세금 등 궁금한 걸 물어봐요',   isAnonymousAllowed: false, sortOrder: 4 },
];

async function ensureUniversityBoards(universityShortName) {
  // slug 생성은 server/index.js의 seed/migration과 동일해야 중복 방지됨
  const prefix = universityShortName.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, '-');
  for (const tmpl of UNIVERSITY_BOARD_TEMPLATES) {
    const slug = `${prefix}-${tmpl.slugSuffix}`;
    const exists = await Board.findOne({ slug });
    if (!exists) {
      await Board.create({
        slug,
        name: tmpl.name,
        description: tmpl.description,
        isAnonymousAllowed: tmpl.isAnonymousAllowed,
        sortOrder: tmpl.sortOrder,
        university: universityShortName,
        isUniversityBoard: true,
      });
    }
  }
}

const REASON_LABELS = { spam: '스팸/도배', hate: '욕설/혐오', illegal: '불법정보', adult: '음란물', etc: '기타' };

// GET /api/admin/reports?status=pending
router.get('/reports', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const reports = await Report.find({ status })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('reporterId', 'nickname email');

    const formatted = await Promise.all(reports.map(async (r) => {
      let targetPreview = '';
      if (r.targetType === 'post') {
        const post = await Post.findById(r.targetId).select('title userId').populate('userId', 'nickname');
        targetPreview = post ? `[글] ${post.title} — by ${post.userId?.nickname ?? '?'}` : '(삭제됨)';
      } else {
        const comment = await Comment.findById(r.targetId).select('content userId').populate('userId', 'nickname');
        targetPreview = comment ? `[댓글] ${comment.content.slice(0, 40)} — by ${comment.userId?.nickname ?? '?'}` : '(삭제됨)';
      }
      return {
        id: r._id,
        reporterNickname: r.reporterId?.nickname,
        reporterEmail: r.reporterId?.email,
        targetType: r.targetType,
        targetId: r.targetId,
        postId: r.postId,
        reason: REASON_LABELS[r.reason] ?? r.reason,
        detail: r.detail,
        targetPreview,
        status: r.status,
        createdAt: r.createdAt,
      };
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/admin/reports/:id/resolve — 처리 완료 (게시글/댓글 삭제)
router.put('/reports/:id/resolve', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: '신고를 찾을 수 없습니다.' });

    // 대상 게시글/댓글 삭제
    if (report.targetType === 'post') {
      await Post.findByIdAndDelete(report.targetId);
    } else {
      await Comment.findByIdAndDelete(report.targetId);
      if (report.postId) {
        await Post.findByIdAndUpdate(report.postId, { $inc: { commentCount: -1 } });
      }
    }

    // 같은 대상의 모든 신고 resolved 처리
    await Report.updateMany({ targetId: report.targetId }, { status: 'resolved', adminNote: req.body.adminNote || '' });

    res.json({ success: true, data: { message: '처리 완료 및 콘텐츠 삭제됨' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/admin/reports/:id/dismiss — 신고 기각
router.put('/reports/:id/dismiss', async (req, res) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed', adminNote: req.body.adminNote || '' });
    res.json({ success: true, data: { message: '신고 기각됨' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════════════
// 유저 관리
// ═══════════════════════════════════════════════════

// GET /api/admin/users?q=&status=&role=&page=
router.get('/users', async (req, res) => {
  try {
    const { q = '', status, role, page = 1 } = req.query;
    const limit = 30;
    const conditions = [];
    if (q) {
      conditions.push({ $or: [
        { nickname: { $regex: q, $options: 'i' } },
        { email:    { $regex: q, $options: 'i' } },
      ]});
    }
    if (status === 'active') {
      // status 필드가 없거나 'active'인 유저 모두 포함
      conditions.push({ $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] });
    } else if (status) {
      conditions.push({ status });
    }
    const filter = conditions.length ? (conditions.length === 1 ? conditions[0] : { $and: conditions }) : {};
    if (role) filter.role = role;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('email nickname role status verified university city createdAt suspendedUntil shadowBanned warningCount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ success: true, data: { users, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!u) return res.status(404).json({ success: false, message: '유저를 찾을 수 없어요' });

    const [postCount, commentCount, reportCount, reportedCount] = await Promise.all([
      Post.countDocuments({ userId: u._id }),
      Comment.countDocuments({ userId: u._id }),
      Report.countDocuments({ reporterId: u._id }),
      // 본인을 대상으로 한 신고 수
      (async () => {
        const myPosts = await Post.find({ userId: u._id }).select('_id').lean();
        const myComments = await Comment.find({ userId: u._id }).select('_id').lean();
        const ids = [...myPosts.map(p => p._id), ...myComments.map(c => c._id)];
        return Report.countDocuments({ targetId: { $in: ids } });
      })(),
    ]);

    res.json({
      success: true,
      data: { ...u, stats: { postCount, commentCount, reportCount, reportedCount } },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/users/:id/sanction { type, days, reason }
// type: warn | suspend | ban | unban | shadow | unshadow
router.put('/users/:id/sanction', async (req, res) => {
  try {
    const { type, days = 0, reason = '' } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: '유저를 찾을 수 없어요' });
    if (String(target._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '본인에게는 제재할 수 없어요' });
    }

    let update = {};
    if (type === 'warn') {
      update = { $inc: { warningCount: 1 }, $set: { suspendReason: reason } };
    } else if (type === 'suspend') {
      const until = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
      console.log('[SANCTION] suspend days:', days, 'until:', until);
      update = { $set: { status: 'suspended', suspendedUntil: until, suspendReason: reason } };
    } else if (type === 'ban') {
      update = { $set: { status: 'banned', suspendedUntil: null, suspendReason: reason } };
    } else if (type === 'unban') {
      update = { $set: { status: 'active', suspendedUntil: null, suspendReason: '' } };
    } else if (type === 'shadow') {
      update = { $set: { shadowBanned: true } };
    } else if (type === 'unshadow') {
      update = { $set: { shadowBanned: false } };
    } else {
      return res.status(400).json({ success: false, message: '잘못된 제재 유형' });
    }

    await User.updateOne({ _id: target._id }, update);
    logAdmin(req, `user.${type}`, { targetType: 'user', targetId: target._id, meta: { days, reason } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/users/:id/role { role }
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'student', 'working_holiday', 'general'].includes(role)) {
      return res.status(400).json({ success: false, message: '잘못된 역할' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: '유저를 찾을 수 없어요' });

    // 본인 강등 차단
    if (String(target._id) === String(req.user.id) && target.role === 'admin' && role !== 'admin') {
      return res.status(400).json({ success: false, message: '본인의 admin 권한은 해제할 수 없어요' });
    }
    // 마지막 admin 보호
    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: '마지막 관리자는 강등할 수 없어요' });
      }
    }

    target.role = role;
    await target.save();
    logAdmin(req, 'user.role', { targetType: 'user', targetId: target._id, meta: { role } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/users/:id/profile { nickname?, bio? } — 강제 수정
router.put('/users/:id/profile', async (req, res) => {
  try {
    const patch = {};
    if (typeof req.body.nickname === 'string') patch.nickname = req.body.nickname.trim();
    if (typeof req.body.bio === 'string')      patch.bio = req.body.bio.trim();
    if (typeof req.body.avatarUrl === 'string') patch.avatarUrl = req.body.avatarUrl;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: '수정할 항목이 없어요' });
    }
    await User.findByIdAndUpdate(req.params.id, patch);
    logAdmin(req, 'user.profile', { targetType: 'user', targetId: req.params.id, meta: patch });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/users/:id — 강제 탈퇴 (hard delete)
// 본인 탈퇴(DELETE /api/auth/me)와 동일한 방식:
//  - 작성 글/댓글은 userId=null, isAnonymous=true 로 전환("탈퇴한 회원" 표시)
//  - 유저 레코드는 DB에서 완전 삭제, 관련 메타데이터도 정리
router.delete('/users/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '본인은 탈퇴시킬 수 없어요' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: '유저를 찾을 수 없어요' });
    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: '마지막 관리자는 탈퇴시킬 수 없어요' });
      }
    }

    const Block = require('../models/Block');
    const Notification = require('../models/Notification');
    const Inquiry = require('../models/Inquiry');
    const Bookmark = require('../models/Bookmark');
    const userId = target._id;

    await Post.updateMany({ likedBy: userId }, { $pull: { likedBy: userId }, $inc: { likeCount: -1 } });
    await Promise.all([
      Post.updateMany({ userId }, { $set: { userId: null, isAnonymous: true } }),
      Comment.updateMany({ userId }, { $set: { userId: null, isAnonymous: true } }),
      Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
      Report.deleteMany({ reporterId: userId }),
      VerifyRequest.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      Inquiry.deleteMany({ userId }),
      Bookmark.deleteMany({ userId }),
    ]);

    await User.findByIdAndDelete(userId);
    logAdmin(req, 'user.delete', { targetType: 'user', targetId: userId, meta: { reason: req.body.reason || '', hardDelete: true } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 콘텐츠 관리 (게시글/댓글)
// ═══════════════════════════════════════════════════

// GET /api/admin/posts?q=&boardId=&userId=&hidden=&page=
router.get('/posts', async (req, res) => {
  try {
    const { q = '', boardId, boardIds, userId, hidden, page = 1 } = req.query;
    const limit = 30;
    const filter = {};
    if (q) filter.$or = [{ title: { $regex: q, $options: 'i' } }, { content: { $regex: q, $options: 'i' } }];
    if (boardId) filter.boardId = boardId;
    else if (boardIds) {
      const ids = String(boardIds).split(',').filter(Boolean);
      if (ids.length) filter.boardId = { $in: ids };
    }
    if (userId) filter.userId = userId;
    if (hidden === 'true') filter.hidden = true;
    if (hidden === 'false') filter.hidden = { $ne: true };

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'nickname email')
      .populate('boardId', 'name slug')
      .lean();

    res.json({ success: true, data: { posts, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/posts/:id/hide { hidden, reason }
router.put('/posts/:id/hide', async (req, res) => {
  try {
    const { hidden = true, reason = '' } = req.body;
    await Post.findByIdAndUpdate(req.params.id, { hidden, hiddenReason: reason });
    logAdmin(req, hidden ? 'post.hide' : 'post.unhide', { targetType: 'post', targetId: req.params.id, meta: { reason } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/posts/:id/pin { pinned }
router.put('/posts/:id/pin', async (req, res) => {
  try {
    const { pinned = true } = req.body;
    await Post.findByIdAndUpdate(req.params.id, { pinned });
    logAdmin(req, pinned ? 'post.pin' : 'post.unpin', { targetType: 'post', targetId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/posts/:id/move { boardId }
router.put('/posts/:id/move', async (req, res) => {
  try {
    const { boardId } = req.body;
    if (!boardId) return res.status(400).json({ success: false, message: 'boardId 필요' });
    await Post.findByIdAndUpdate(req.params.id, { boardId });
    logAdmin(req, 'post.move', { targetType: 'post', targetId: req.params.id, meta: { boardId } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/posts/:id — 강제 삭제
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (post) await Comment.deleteMany({ postId: post._id });
    logAdmin(req, 'post.delete', { targetType: 'post', targetId: req.params.id, meta: { reason: req.body.reason || '' } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/comments/:id
router.delete('/comments/:id', async (req, res) => {
  try {
    const c = await Comment.findByIdAndDelete(req.params.id);
    if (c?.postId) await Post.findByIdAndUpdate(c.postId, { $inc: { commentCount: -1 } });
    logAdmin(req, 'comment.delete', { targetType: 'comment', targetId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 게시판 관리
// ═══════════════════════════════════════════════════

// GET /api/admin/boards
router.get('/boards', async (req, res) => {
  try {
    const boards = await Board.find().sort({ isUniversityBoard: 1, sortOrder: 1 }).lean();
    const withCounts = await Promise.all(boards.map(async (b) => ({
      ...b,
      postCount: await Post.countDocuments({ boardId: b._id }),
    })));
    res.json({ success: true, data: withCounts });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// POST /api/admin/boards
router.post('/boards', async (req, res) => {
  try {
    const { slug, name, description = '', isAnonymousAllowed = false, sortOrder = 0, isUniversityBoard = false, university = '' } = req.body;
    if (!slug || !name) return res.status(400).json({ success: false, message: 'slug와 name 필요' });
    // 학교 게시판이면 university+slug 조합으로 중복 체크
    const dupFilter = isUniversityBoard && university
      ? { slug, university }
      : { slug, isUniversityBoard: false };
    const exists = await Board.findOne(dupFilter);
    if (exists) return res.status(409).json({ success: false, message: '이미 존재하는 게시판입니다' });
    const b = await Board.create({ slug, name, description, isAnonymousAllowed, sortOrder, isUniversityBoard, university });
    logAdmin(req, 'board.create', { targetType: 'board', targetId: b._id, meta: { slug, name } });
    res.json({ success: true, data: b });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/boards/:id
router.put('/boards/:id', async (req, res) => {
  try {
    const patch = {};
    ['name', 'description', 'isAnonymousAllowed', 'sortOrder'].forEach(k => {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    });
    await Board.findByIdAndUpdate(req.params.id, patch);
    logAdmin(req, 'board.update', { targetType: 'board', targetId: req.params.id, meta: patch });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/boards/:id
router.delete('/boards/:id', async (req, res) => {
  try {
    const cnt = await Post.countDocuments({ boardId: req.params.id });
    if (cnt > 0) {
      return res.status(400).json({ success: false, message: `게시글이 ${cnt}개 있어 삭제 불가` });
    }
    await Board.findByIdAndDelete(req.params.id);
    logAdmin(req, 'board.delete', { targetType: 'board', targetId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 통계 / 대시보드
// ═══════════════════════════════════════════════════

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const dayAgo  = new Date(now - 24 * 3600 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 3600 * 1000);

    const [
      totalUsers, activeUsers, suspendedUsers, bannedUsers,
      totalPosts, totalComments, totalReportsPending,
      newUsers24h, newUsers7d, newUsers30d,
      newPosts24h, newPosts7d,
      verifyPending, inquiryOpen,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'banned' }),
      Post.countDocuments(),
      Comment.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ createdAt: { $gte: dayAgo } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Post.countDocuments({ createdAt: { $gte: dayAgo } }),
      Post.countDocuments({ createdAt: { $gte: weekAgo } }),
      VerifyRequest.countDocuments({ status: 'pending' }),
      mongoose.model('Inquiry').countDocuments({ status: 'open' }).catch(() => 0),
    ]);

    // 최근 7일 일별 신규 가입 추이
    const signupTrend = await User.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers },
        content: { posts: totalPosts, comments: totalComments },
        pending: { reports: totalReportsPending, verify: verifyPending, inquiry: inquiryOpen },
        signups: { d1: newUsers24h, d7: newUsers7d, d30: newUsers30d },
        posts: { d1: newPosts24h, d7: newPosts7d },
        signupTrend,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 시스템 설정 (점검모드, 금지어, 차단 IP)
// ═══════════════════════════════════════════════════

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const all = await SystemSetting.find().lean();
    const map = {};
    all.forEach(s => { map[s.key] = s.value; });
    res.json({
      success: true,
      data: {
        maintenance: map.maintenance || { enabled: false, message: '' },
        bannedWords: map.bannedWords || [],
        blockedIps:  map.blockedIps || [],
        forceUpdate: map.forceUpdate || { enabled: false, minVersion: '' },
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/settings/:key
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await SystemSetting.findOneAndUpdate(
      { key },
      { $set: { value } },
      { upsert: true, new: true }
    );
    invalidateSystemCache();
    logAdmin(req, `setting.${key}`, { targetType: 'system', meta: { value } });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 관리자 활동 로그
// ═══════════════════════════════════════════════════

// GET /api/admin/logs?action=&adminId=&page=
router.get('/logs', async (req, res) => {
  try {
    const { action, adminId, page = 1 } = req.query;
    const limit = 50;
    const filter = {};
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (adminId) filter.adminId = adminId;
    const total = await AdminLog.countDocuments(filter);
    const logs = await AdminLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({ success: true, data: { logs, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════
// 알림 — 타겟 푸시 (전체/도시/학교/역할)
// ═══════════════════════════════════════════════════

// POST /api/admin/push { title, body, target: {city?, university?, role?} }
router.post('/push', async (req, res) => {
  try {
    const { title, body, target = {} } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: '제목/내용 필요' });
    const filter = { pushToken: { $ne: '' }, 'notificationSettings.enabled': true };
    if (target.city) filter.city = target.city;
    if (target.university) filter.university = target.university;
    if (target.role) filter.role = target.role;

    const users = await User.find(filter).select('pushToken').lean();
    const { sendPush } = require('../utils/push');
    users.forEach(u => sendPush(u.pushToken, title, body, { type: 'admin_broadcast' }));
    logAdmin(req, 'push.broadcast', { targetType: 'system', meta: { count: users.length, target } });
    res.json({ success: true, data: { sent: users.length } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
