const express = require('express');
const mongoose = require('mongoose');
const VerifyRequest = require('../models/VerifyRequest');
const User = require('../models/User');
const Board = require('../models/Board');
const University = require('../models/University');
const Notification = require('../models/Notification');
const { sendPush } = require('../utils/push');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const AdminLog = require('../models/AdminLog');
const SystemSetting = require('../models/SystemSetting');
const Business = require('../models/Business');
const BusinessBookmark = require('../models/BusinessBookmark');
const DailyActive = require('../models/DailyActive');
const { geocodeAddress } = require('../utils/geocode');
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
    request.adminNote = String(adminNote || '').slice(0, 1000);
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({ success: true, data: { message: '거절 완료' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 학교 게시판 자동 생성 헬퍼 (free + anonymous 2종)
const UNIVERSITY_BOARD_TEMPLATES = [
  { slugSuffix: 'free',      name: '학교자유게시판',     description: '학교 친구들과 자유롭게 이야기해요', isAnonymousAllowed: false, sortOrder: 1 },
  { slugSuffix: 'anonymous', name: '학교 익명',          description: '익명으로 털어놓아요',               isAnonymousAllowed: true,  sortOrder: 2 },
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
      let targetText = '';        // 본문/제목 등 신고 대상 콘텐츠
      let liveAuthor = null;      // 현재 살아있는 작성자 (탈퇴 안 했으면)
      let liveIsAnonymous = !!r.targetIsAnonymous;

      if (r.targetType === 'post') {
        const post = await Post.findById(r.targetId).select('title userId isAnonymous').populate('userId', 'nickname email');
        if (post) {
          targetText = `[글] ${post.title}`;
          liveAuthor = post.userId || null;
          liveIsAnonymous = !!post.isAnonymous;
        } else {
          targetText = '(삭제됨)';
        }
      } else if (r.targetType === 'comment') {
        const comment = await Comment.findById(r.targetId).select('content userId isAnonymous').populate('userId', 'nickname email');
        if (comment) {
          targetText = `[댓글] ${comment.content.slice(0, 60)}`;
          liveAuthor = comment.userId || null;
          liveIsAnonymous = !!comment.isAnonymous;
        } else {
          targetText = '(삭제됨)';
        }
      } else if (r.targetType === 'user') {
        targetText = '[사용자]';
        const u = r.targetAuthorId ? await User.findById(r.targetAuthorId).select('nickname email').lean() : null;
        liveAuthor = u || null;
      } else if (r.targetType === 'business') {
        const biz = await Business.findById(r.targetId).select('name status').lean();
        targetText = biz ? `[업체] ${biz.name}` : '(삭제됨)';
      }

      // 작성자 정보: 라이브 우선, 없으면(탈퇴) 신고 시점 스냅샷 사용
      const isDeleted = !liveAuthor && !!r.targetAuthorId; // 신고 시엔 있었지만 지금은 없음 → 탈퇴
      const targetAuthor = {
        userId: liveAuthor?._id || r.targetAuthorId || null,
        nickname: liveAuthor?.nickname || r.targetAuthorNickname || '',
        email: liveAuthor?.email || null,
        isAnonymous: liveIsAnonymous,
        isDeleted,
      };

      return {
        id: r._id,
        reporterNickname: r.reporterId?.nickname,
        reporterEmail: r.reporterId?.email,
        targetType: r.targetType,
        targetId: r.targetId,
        postId: r.postId,
        reason: REASON_LABELS[r.reason] ?? r.reason,
        detail: r.detail,
        targetText,
        targetAuthor,
        // legacy field — 기존 클라이언트 호환
        targetPreview: targetText
          + (targetAuthor.nickname
              ? ` — by ${targetAuthor.nickname}${targetAuthor.isAnonymous ? ' (익명)' : ''}${isDeleted ? ' (탈퇴)' : ''}`
              : ''),
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
    await Report.updateMany({ targetId: report.targetId }, { status: 'resolved', adminNote: String(req.body.adminNote || '').slice(0, 1000) });

    res.json({ success: true, data: { message: '처리 완료 및 콘텐츠 삭제됨' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/admin/reports/:id/dismiss — 신고 기각
router.put('/reports/:id/dismiss', async (req, res) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed', adminNote: String(req.body.adminNote || '').slice(0, 1000) });
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
      const safeQ = String(q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ $or: [
        { nickname: { $regex: safeQ, $options: 'i' } },
        { email:    { $regex: safeQ, $options: 'i' } },
      ]});
    }
    if (status === 'active') {
      // status 필드가 없거나 'active'인 유저 모두 포함
      conditions.push({ $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] });
    } else if (status) {
      conditions.push({ status });
    } else {
      // '전체' 탭: 탈퇴(deleted) 회원은 제외 (탈퇴 탭에서만 노출)
      conditions.push({ status: { $ne: 'deleted' } });
    }
    const filter = conditions.length ? (conditions.length === 1 ? conditions[0] : { $and: conditions }) : {};
    if (role) filter.role = role;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('email nickname role status verified university city createdAt suspendedUntil shadowBanned warningCount deletedAt')
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

    const [postCount, commentCount, reportCount, reportedCount, leaderOf] = await Promise.all([
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
      // 이 회원이 학생회장으로 임명된 학교 (해당 학교명 또는 null)
      University.findOne({ leaderUserId: u._id }).select('name').lean().then(r => r?.name || null),
    ]);

    res.json({
      success: true,
      data: {
        ...u,
        stats: { postCount, commentCount, reportCount, reportedCount },
        universityLeaderOf: leaderOf,
      },
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

// PUT /api/admin/users/:id/university-leader { isLeader: boolean }
// 인증 회원을 본인 학교의 학생회장으로 임명/해제. 학교당 1명, 자기 학교만.
router.put('/users/:id/university-leader', async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('verified university nickname');
    if (!target) return res.status(404).json({ success: false, message: '유저를 찾을 수 없어요' });
    if (!target.verified || !target.university) {
      return res.status(400).json({ success: false, message: '학교 인증된 회원만 임명할 수 있어요.' });
    }
    const uni = await University.findOne({ name: target.university });
    if (!uni) {
      return res.status(404).json({ success: false, message: '대상 학교를 학교 마스터에서 찾을 수 없어요.' });
    }

    const isLeader = !!req.body?.isLeader;
    if (isLeader) {
      uni.leaderUserId = target._id;
    } else if (uni.leaderUserId && String(uni.leaderUserId) === String(target._id)) {
      uni.leaderUserId = null;
    }
    await uni.save();

    // 임명 시 새 학생회장에게 알림 + 푸시 (해제 시는 알림 없음)
    if (isLeader) {
      try {
        await Notification.create({
          userId: target._id,
          type: 'university_leader',
          message: `${target.university}의 학생회장으로 임명되었어요. 학교 커뮤니티를 꾸며보세요!`,
        });
        const withPush = await User.findById(target._id).select('pushToken').lean();
        if (withPush?.pushToken) {
          await sendPush(
            withPush.pushToken,
            '학생회장 임명',
            `${target.university}의 학생회장이 되었어요`,
            { kind: 'university_leader', university: target.university },
            target._id
          );
        }
      } catch (e) {
        console.error('[leader notify]', e.message);
      }
    }

    logAdmin(req, 'university.leader', {
      targetType: 'user', targetId: target._id,
      meta: { university: target.university, isLeader },
    });
    res.json({ success: true, data: { university: target.university, isLeader } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
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
      // 학교 학생회장 자리 정리 — 죽은 참조 방지
      University.updateMany({ leaderUserId: userId }, { $set: { leaderUserId: null } }),
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
    if (q) {
      const safeQ = String(q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: { $regex: safeQ, $options: 'i' } }, { content: { $regex: safeQ, $options: 'i' } }];
    }
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
// 학교 관리 (University)
// ═══════════════════════════════════════════════════

// GET /api/admin/universities
router.get('/universities', async (req, res) => {
  try {
    const list = await University.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// POST /api/admin/universities
// 신규 학교 추가 시 free/anonymous 학교 게시판도 자동 생성 (ensureUniversityBoards)
router.post('/universities', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim();
    const fullName = (req.body?.fullName || '').trim() || name;
    const sortOrder = Number(req.body?.sortOrder) || 0;
    const active = req.body?.active !== false;
    if (!name) return res.status(400).json({ success: false, message: '학교 이름이 필요합니다.' });
    const exists = await University.findOne({ name });
    if (exists) return res.status(409).json({ success: false, message: '이미 존재하는 학교입니다.' });
    const u = await University.create({ name, fullName, sortOrder, active });
    // 신규 학교 회원이 인증해도 곧바로 학교 게시판이 보이도록 같은 트랜잭션에서 보드 시드
    await ensureUniversityBoards(name);
    logAdmin(req, 'university.create', { targetType: 'university', targetId: u._id, meta: { name } });
    res.json({ success: true, data: u });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/universities/:id
// name 변경 시 Board.university / User.university도 함께 갱신
router.put('/universities/:id', async (req, res) => {
  try {
    const u = await University.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: '학교를 찾을 수 없어요.' });

    const patch = {};
    const oldName = u.name;
    let renamed = false;
    if (req.body?.name !== undefined) {
      const newName = String(req.body.name).trim();
      if (!newName) return res.status(400).json({ success: false, message: '학교 이름이 필요합니다.' });
      if (newName !== oldName) {
        const dup = await University.findOne({ name: newName, _id: { $ne: u._id } });
        if (dup) return res.status(409).json({ success: false, message: '이미 존재하는 학교 이름입니다.' });
        patch.name = newName;
        renamed = true;
      }
    }
    if (req.body?.fullName !== undefined) patch.fullName = String(req.body.fullName).trim();
    if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.active !== undefined) patch.active = !!req.body.active;

    await University.findByIdAndUpdate(u._id, patch);

    // name 변경 시 참조하는 컬렉션도 함께 마이그레이션
    if (renamed) {
      const VerifyRequest = require('../models/VerifyRequest');
      await Board.updateMany({ university: oldName }, { $set: { university: patch.name } });
      await User.updateMany({ university: oldName }, { $set: { university: patch.name } });
      await VerifyRequest.updateMany({ university: oldName }, { $set: { university: patch.name } });
    }

    logAdmin(req, 'university.update', { targetType: 'university', targetId: u._id, meta: { patch, renamedFrom: renamed ? oldName : undefined } });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/universities/:id
// 인증된 회원·게시판이 참조 중이면 거부 (active=false로 비활성화 유도)
router.delete('/universities/:id', async (req, res) => {
  try {
    const u = await University.findById(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: '학교를 찾을 수 없어요.' });

    const userCount = await User.countDocuments({ university: u.name });
    const boardCount = await Board.countDocuments({ university: u.name });
    if (userCount > 0 || boardCount > 0) {
      return res.status(400).json({
        success: false,
        message: `참조 중인 데이터가 있어 삭제 불가 (회원 ${userCount}명, 게시판 ${boardCount}개). 비활성화로 처리해 주세요.`,
      });
    }

    await u.deleteOne();
    logAdmin(req, 'university.delete', { targetType: 'university', targetId: u._id, meta: { name: u.name } });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
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
      totalUsers, activeUsers, suspendedUsers, bannedUsers, deletedUsers,
      totalPosts, totalComments, totalReportsPending,
      newUsers24h, newUsers7d, newUsers30d,
      newPosts24h, newPosts7d,
      verifyPending, inquiryOpen, groupsPending, businessesPending,
    ] = await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }), // 탈퇴 제외 (전체 회원수)
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ status: 'deleted' }),
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
      Group.countDocuments({ status: 'pending_review' }).catch(() => 0),
      Business.countDocuments({ status: 'pending' }).catch(() => 0),
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

    // ── DAU (일일 방문자) — 최근 14일, 시드 계정 제외, 토론토 날짜 기준 ──
    const dayKeys = [...Array(14)].map((_, i) =>
      new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    ).reverse();
    const seedIds = (await User.find({ email: /^seed\d+@/ }).select('_id').lean()).map((u) => u._id);
    const dauAgg = await DailyActive.aggregate([
      { $match: { date: { $in: dayKeys }, userId: { $nin: seedIds } } },
      { $group: { _id: '$date', count: { $sum: 1 } } },
    ]);
    const dauMap = Object.fromEntries(dauAgg.map((r) => [r._id, r.count]));
    const dauTrend = dayKeys.map((d) => ({ date: d, count: dauMap[d] || 0 }));

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers, deleted: deletedUsers },
        content: { posts: totalPosts, comments: totalComments },
        pending: { reports: totalReportsPending, verify: verifyPending, inquiry: inquiryOpen, groups: groupsPending, businesses: businessesPending },
        signups: { d1: newUsers24h, d7: newUsers7d, d30: newUsers30d },
        posts: { d1: newPosts24h, d7: newPosts7d },
        signupTrend,
        dau: { today: dauTrend[dauTrend.length - 1]?.count || 0, trend: dauTrend },
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
    if (action) {
      const safeAction = String(action).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.action = { $regex: safeAction, $options: 'i' };
    }
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

    const users = await User.find(filter).select('_id pushToken').lean();
    const { sendPush } = require('../utils/push');
    users.forEach(u => sendPush(u.pushToken, title, body, { type: 'admin_broadcast' }, u._id));
    logAdmin(req, 'push.broadcast', { targetType: 'system', meta: { count: users.length, target } });
    res.json({ success: true, data: { sent: users.length } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── 모임 (Group) 승인 ──────────────────────────────────
// GET /api/admin/groups?status=pending_review|active|rejected|closed
router.get('/groups', async (req, res) => {
  try {
    const { status = 'pending_review' } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const groups = await Group.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('ownerId', 'nickname email avatarUrl verified')
      .lean();
    res.json({ success: true, data: groups });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/groups/:id/approve — 승인
router.put('/groups/:id/approve', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    if (group.status !== 'pending_review') {
      return res.status(400).json({ success: false, message: '승인 대기 상태가 아니에요.' });
    }
    group.status = 'active';
    group.reviewedBy = req.user.id;
    group.reviewedAt = new Date();
    await group.save();

    // 그룹 채팅방 자동 생성 — 활성 멤버 전부 참여
    try {
      const existing = await ChatRoom.findOne({ groupId: group._id, kind: 'group' });
      if (!existing) {
        const activeMembers = await GroupMembership.find({
          groupId: group._id, status: 'active',
        }).distinct('userId');
        await ChatRoom.create({
          kind: 'group',
          groupId: group._id,
          groupName: group.name,
          groupCoverImage: group.coverImage || '',
          participants: activeMembers,
          status: 'accepted',
        });
      }
    } catch (e) { console.error('group chat create failed:', e.message); }

    try {
      await Notification.create({
        userId: group.ownerId,
        type: 'group_approved',
        message: `'${group.name}' 모임이 승인되었어요.`,
      });
    } catch {}

    logAdmin(req, 'group.approve', { targetType: 'group', targetId: group._id, meta: { name: group.name } });
    res.json({ success: true, data: { id: group._id, status: group.status } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/groups/:id/reject — 거절
router.put('/groups/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    if (group.status !== 'pending_review') {
      return res.status(400).json({ success: false, message: '승인 대기 상태가 아니에요.' });
    }
    group.status = 'rejected';
    group.rejectReason = String(reason || '').slice(0, 500);
    group.reviewedBy = req.user.id;
    group.reviewedAt = new Date();
    await group.save();

    // 신청자 본인 멤버십도 정리
    await GroupMembership.deleteMany({ groupId: group._id });

    try {
      await Notification.create({
        userId: group.ownerId,
        type: 'group_rejected',
        message: `'${group.name}' 모임 신청이 거절되었어요.${reason ? ` (사유: ${reason})` : ''}`,
      });
    } catch {}

    logAdmin(req, 'group.reject', { targetType: 'group', targetId: group._id, meta: { name: group.name, reason } });
    res.json({ success: true, data: { id: group._id, status: group.status } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/groups/:id — admin 강제 폐쇄 (cascade)
router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    // 그룹 채팅방 삭제 (메시지·알림까지)
    const chatRoom = await ChatRoom.findOne({ groupId: group._id, kind: 'group' });
    if (chatRoom) {
      await Promise.all([
        Message.deleteMany({ roomId: chatRoom._id }),
        Notification.deleteMany({ roomId: chatRoom._id }),
        chatRoom.deleteOne(),
      ]);
    }
    await Promise.all([
      Post.deleteMany({ groupId: group._id }),
      GroupMembership.deleteMany({ groupId: group._id }),
    ]);
    group.status = 'closed';
    group.closedAt = new Date();
    await group.save();
    logAdmin(req, 'group.close', { targetType: 'group', targetId: group._id, meta: { name: group.name } });
    res.json({ success: true, data: { id: group._id, status: 'closed' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════════════
// 한인 업체 관리 (지도)
// ═══════════════════════════════════════════════════════════
function formatAdminBusiness(b) {
  const coords = b.location?.coordinates;
  return {
    id: b._id,
    name: b.name,
    category: b.category,
    city: b.city,
    address: b.address,
    phone: b.phone || '',
    hours: b.hours || '',
    description: b.description || '',
    images: b.images || [],
    lat: Array.isArray(coords) ? coords[1] : null,
    lng: Array.isArray(coords) ? coords[0] : null,
    hasLocation: Array.isArray(coords) && coords.length === 2,
    source: b.source,
    status: b.status,
    bookmarkCount: b.bookmarkCount || 0,
    reportCount: b.reportCount || 0,
    submittedBy: b.submittedBy || null,
    submitterNickname: b.submitterNickname || '',
    sourceName: b.sourceName || '',
    createdAt: b.createdAt,
  };
}

// GET /api/admin/businesses?status= — 전체 목록 + 상태별 카운트
router.get('/businesses', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    const list = await Business.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    const [pending, approved, rejected] = await Promise.all([
      Business.countDocuments({ status: 'pending' }),
      Business.countDocuments({ status: 'approved' }),
      Business.countDocuments({ status: 'rejected' }),
    ]);
    res.json({ success: true, data: list.map(formatAdminBusiness), counts: { pending, approved, rejected } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/admin/businesses/:id — 승인/거절/정보 수정 (주소 변경/좌표 없으면 재지오코딩)
router.put('/businesses/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없어요.' });
    const b = await Business.findById(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: '업체를 찾을 수 없어요.' });

    const { status, name, category, city, address, phone, hours, description, rejectedReason } = req.body;
    if (status && ['pending', 'approved', 'rejected'].includes(status)) b.status = status;
    if (typeof name === 'string' && name.trim()) b.name = name.trim();
    if (category && Business.CATEGORIES.includes(category)) b.category = category;
    if (city) b.city = city;
    if (typeof phone === 'string') b.phone = phone.trim();
    if (typeof hours === 'string') b.hours = hours.trim();
    if (typeof description === 'string') b.description = description.trim();
    if (typeof rejectedReason === 'string') b.rejectedReason = rejectedReason;

    let addressChanged = false;
    if (typeof address === 'string' && address.trim() && address.trim() !== b.address) {
      b.address = address.trim();
      addressChanged = true;
    }
    const hasLoc = b.location && Array.isArray(b.location.coordinates) && b.location.coordinates.length === 2;
    if (addressChanged || !hasLoc) {
      const geo = await geocodeAddress(b.address, b.city);
      if (geo) b.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
    }

    await b.save();
    logAdmin(req, 'business.update', { targetType: 'business', targetId: b._id, meta: { status: b.status } });
    res.json({ success: true, data: formatAdminBusiness(b) });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/admin/businesses/:id — 삭제 (즐겨찾기·신고 cascade)
router.delete('/businesses/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '업체를 찾을 수 없어요.' });
    const b = await Business.findById(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: '업체를 찾을 수 없어요.' });
    await Promise.all([
      BusinessBookmark.deleteMany({ businessId: b._id }),
      Report.deleteMany({ targetType: 'business', targetId: b._id }),
    ]);
    await b.deleteOne();
    logAdmin(req, 'business.delete', { targetType: 'business', targetId: b._id, meta: { name: b.name } });
    res.json({ success: true, data: { id: b._id } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
