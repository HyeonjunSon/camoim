const express = require('express');
const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');
const Board = require('../models/Board');
const GroupMembership = require('../models/GroupMembership');
const { optionalAuth } = require('../middleware/auth');
const { toContentPreview } = require('../utils/contentPreview');

const router = express.Router();

// GET /api/search?q=keyword&type=all|posts|groups|users&limit=20
// 통합 검색 — 게시글 + 모임 + 사용자 한 번에 검색
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { q, type = 'all', limit: limitQ } = req.query;
    const limit = Math.min(parseInt(limitQ) || 20, 50);

    if (!q?.trim() || q.trim().length < 2) {
      return res.json({ success: true, data: { posts: [], groups: [], users: [] } });
    }

    const safe = String(q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    const results = { posts: [], groups: [], users: [] };

    // ── 게시글 검색 ───────────────────────────────────
    if (type === 'all' || type === 'posts') {
      const postFilter = {
        isDeleted: { $ne: true },
        $or: [{ title: regex }, { content: regex }],
      };
      const posts = await Post.find(postFilter)
        .populate('userId', 'nickname avatarUrl')
        .populate('boardId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      results.posts = posts.map(p => ({
        id: p._id,
        title: p.title,
        content: toContentPreview(p.content),
        isAnonymous: p.isAnonymous,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        boardName: p.boardId?.name,
        boardSlug: p.boardId?.slug,
        boardId: p.boardId?._id,
        groupId: p.groupId,
        nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
        thumbnail: p.images?.[0] ?? null,
      }));
    }

    // ── 모임 검색 ───────────────────────────────────
    if (type === 'all' || type === 'groups') {
      // 학교 동아리는 일반 검색에서 제외 (학교 인증 회원만 볼 수 있는 컨텍스트)
      // — 예외: 본인 가입한 학교 동아리는 검색 가능
      const groupFilter = {
        status: 'active',
        $or: [{ name: regex }, { description: regex }],
      };

      const myGroupIds = req.user
        ? await GroupMembership.find({ userId: req.user.id, status: 'active' }).distinct('groupId')
        : [];

      // 일반 모임(university='') OR 내가 가입한 학교 동아리
      groupFilter.$and = [
        groupFilter.$or ? { $or: groupFilter.$or } : {},
        {
          $or: [
            { university: '' },
            { _id: { $in: myGroupIds } },
          ],
        },
      ];
      delete groupFilter.$or;

      const groups = await Group.find(groupFilter)
        .sort({ memberCount: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      results.groups = groups.map(g => ({
        id: g._id,
        name: g.name,
        description: g.description,
        coverImage: g.coverImage,
        category: g.category,
        city: g.city,
        memberCount: g.memberCount,
        university: g.university || '',
      }));
    }

    // ── 사용자 검색 (닉네임만) ───────────────────────
    if (type === 'all' || type === 'users') {
      const userFilter = {
        nickname: regex,
        deletedAt: { $exists: false }, // 탈퇴 사용자 제외
      };
      const users = await User.find(userFilter)
        .select('_id nickname avatarUrl role verified university')
        .limit(limit)
        .lean();

      results.users = users.map(u => ({
        id: u._id,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        role: u.role,
        verified: !!u.verified,
        university: u.university || '',
      }));
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
