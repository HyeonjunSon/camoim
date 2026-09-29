const express = require('express');
const jwt = require('jsonwebtoken');
const Board = require('../models/Board');
const Post = require('../models/Post');
const User = require('../models/User');
const University = require('../models/University');

const { expandCity } = require('../utils/metro');
const { toContentPreview } = require('../utils/contentPreview');
const { getAllBoards } = require('../utils/boardCache');

const router = express.Router();

// Optional auth — parse a token when present, pass through when absent
async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('role verified university');
      req.user = user ? { id: user._id, role: user.role, verified: user.verified, university: user.university } : null;
    }
  } catch (e) {
    req.user = null;
  }
  next();
}

// GET /api/boards
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Verified students also see their own school's boards
    const myUniversity = (req.user?.role === 'student' && req.user?.verified && req.user?.university) || null;

    // The board list comes from the cache (utils/boardCache.js) — same ordering as Board.find
    const all = await getAllBoards();
    const boards = all.filter((b) =>
      b.isUniversityBoard !== true || (myUniversity && b.university === myUniversity)
    );
    res.json({ success: true, data: boards });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/boards/university — list school boards
// admin: every school's boards / ordinary verified user: their own school only
router.get('/university', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role verified university');
    if (!user) return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    // Admins get every school board
    if (user.role === 'admin') {
      const boards = await Board.find({ isUniversityBoard: true }).sort({ university: 1, sortOrder: 1 });
      return res.json({ success: true, data: boards, isAdmin: true });
    }

    // Ordinary verified users (students and alumni): their own school only
    if (!user.verified || !user.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });
    }

    const boards = await Board.find({ isUniversityBoard: true, university: user.university })
      .sort({ sortOrder: 1 });
    res.json({ success: true, data: boards, isAdmin: false });
  } catch (err) {
    res.status(403).json({ success: false, message: '인증 오류가 발생했습니다.' });
  }
});

// GET /api/boards/:boardId/posts?page=1&limit=20
router.get('/:boardId/posts', async (req, res) => {
  try {
    const { boardId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // School boards are reachable only by verified students
    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ success: false, message: '게시판을 찾을 수 없습니다.' });

    if (board.isUniversityBoard) {
      // Check the token
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('role verified university');
        // Admins can reach every school board
        if (user && user.role === 'admin') {
          // Allowed
        } else if (!user || user.role !== 'student' || !user.verified || user.university !== board.university) {
          return res.status(403).json({ success: false, message: '해당 학교 인증이 필요합니다.' });
        }
      } catch (e) {
        return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });
      }
    }

    // Search, sort and city filter
    const search = req.query.search?.trim();
    const city = req.query.city?.trim();
    const sortBy = req.query.sort || 'latest'; // latest | popular | comments

    const filter = { boardId };
    const cities = expandCity(city);
    if (cities) filter.city = { $in: cities };
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ title: regex }, { content: regex }];
    }
    // Trade status filter for marketplace boards — selling | sold | (none = all)
    const tradeStatus = req.query.tradeStatus;
    if (tradeStatus === 'selling' || tradeStatus === 'sold') {
      filter.tradeStatus = tradeStatus;
    }

    const sortMap = {
      popular: { likeCount: -1, createdAt: -1 },
      comments: { commentCount: -1, createdAt: -1 },
      latest: { createdAt: -1 },
    };
    const sortOption = sortMap[sortBy] || sortMap.latest;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'nickname')
        .populate('boardId', 'name slug'),
      Post.countDocuments(filter),
    ]);

    // For school boards, look up the president once and flag each post for the ⭐ badge
    let leaderUserId = null;
    if (board.isUniversityBoard && board.university) {
      const uni = await University.findOne({ name: board.university }).select('leaderUserId').lean();
      leaderUserId = uni?.leaderUserId ? String(uni.leaderUserId) : null;
    }

    const formatted = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: toContentPreview(p.content),
      isAnonymous: p.isAnonymous,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      boardName: p.boardId?.name,
      nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
      thumbnail: p.images?.[0] ?? null,
      city: p.city || '',
      tradeStatus: p.tradeStatus || 'selling',
      boardSlug: p.boardId?.slug,
      authorIsLeader: !!(leaderUserId && !p.isAnonymous && p.userId?._id && String(p.userId._id) === leaderUserId),
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
