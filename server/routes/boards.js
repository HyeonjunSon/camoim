const express = require('express');
const jwt = require('jsonwebtoken');
const Board = require('../models/Board');
const Post = require('../models/Post');
const User = require('../models/User');

const { expandCity } = require('../utils/metro');

const router = express.Router();

// 선택적 인증 - 토큰 있으면 파싱, 없어도 통과
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
    let query = {};

    // 인증된 학생이면 자기 학교 게시판도 포함
    if (req.user?.role === 'student' && req.user?.verified && req.user?.university) {
      query = {
        $or: [
          { isUniversityBoard: { $ne: true } },
          { university: req.user.university }
        ]
      };
    } else {
      query = { isUniversityBoard: { $ne: true } };
    }

    const boards = await Board.find(query).sort({ isUniversityBoard: 1, sortOrder: 1 });
    res.json({ success: true, data: boards });
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/boards/university - 학교 게시판 목록
// admin: 전체 학교 게시판 / 일반 인증 유저: 본인 학교만
router.get('/university', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role verified university');
    if (!user) return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    // admin은 전체 학교 게시판 반환
    if (user.role === 'admin') {
      const boards = await Board.find({ isUniversityBoard: true }).sort({ university: 1, sortOrder: 1 });
      return res.json({ success: true, data: boards, isAdmin: true });
    }

    // 일반 인증 유저 (재학생/졸업생): 본인 학교만
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

    // 학교 게시판이면 인증된 학생만 접근 가능
    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ success: false, message: '게시판을 찾을 수 없습니다.' });

    if (board.isUniversityBoard) {
      // 토큰 확인
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('role verified university');
        // admin은 모든 학교 게시판 접근 가능
        if (user && user.role === 'admin') {
          // 통과
        } else if (!user || user.role !== 'student' || !user.verified || user.university !== board.university) {
          return res.status(403).json({ success: false, message: '해당 학교 인증이 필요합니다.' });
        }
      } catch (e) {
        return res.status(403).json({ success: false, message: '학교 인증이 필요합니다.' });
      }
    }

    // 검색 & 정렬 & 도시 필터
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

    const formatted = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: p.content,
      isAnonymous: p.isAnonymous,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      boardName: p.boardId?.name,
      nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
      thumbnail: p.images?.[0] ?? null,
      city: p.city || '',
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
