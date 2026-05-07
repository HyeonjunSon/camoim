const express = require('express');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Board = require('../models/Board');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Bookmark = require('../models/Bookmark');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sendPush } = require('../utils/push');
const { getBlockedUserIds } = require('../utils/blocks');
const { containsBannedWord } = require('../middleware/systemGuard');
const mongoose = require('mongoose');

const { expandCity } = require('../utils/metro');
const { LOCAL_BOARD_SLUGS } = require('../constants/boards');
const { toContentPreview } = require('../utils/contentPreview');

const router = express.Router();

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// HTML content에서 <img src="..."> 추출 → 썸네일/이미지 목록용
function extractImagesFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches.map(m => m[1]).slice(0, 10);
}

// ── Cloudinary 이미지 업로드 설정 (최대 5장, 각 10MB)
const cloudStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/posts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    transformation: [{ width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});
const uploadImages = multer({
  storage: cloudStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/posts?search=키워드&limit=20 — 게시글 검색
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, limit: limitQ } = req.query;
    const limit = parseInt(limitQ) || 20;

    if (!search?.trim()) return res.json({ success: true, data: [] });

    const blocked = await getBlockedUserIds(req.user?.id);
    // 학교 게시판 글은 검색에서 제외
    const uniBoardIds = await Board.find({ isUniversityBoard: true }).distinct('_id');
    const regex = new RegExp(search.trim(), 'i');
    const posts = await Post.find({
      $or: [{ title: regex }, { content: regex }],
      groupId: null,
      ...(uniBoardIds.length ? { boardId: { $nin: uniBoardIds } } : {}),
      ...(blocked.length ? { userId: { $nin: blocked } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'nickname')
      .populate('boardId', 'name');

    const result = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: toContentPreview(p.content),
      boardName: p.boardId?.name,
      nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      thumbnail: p.images?.[0] ?? null,
      city: p.city || '',
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/posts/feed?page=1&limit=20
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // 학교 게시판 글은 홈 피드에서 제외
    const uniBoardIds = await Board.find({ isUniversityBoard: true }).distinct('_id');

    const blocked = await getBlockedUserIds(req.user?.id);
    const city = req.query.city?.trim() || '';
    const filter = { hidden: { $ne: true }, autoHidden: { $ne: true }, groupId: null };
    if (uniBoardIds.length) filter.boardId = { $nin: uniBoardIds };
    if (blocked.length) filter.userId = { $nin: blocked };
    const cities = expandCity(city);
    if (cities) filter.city = { $in: cities };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'nickname')
        .populate('boardId', 'name slug'),
      Post.countDocuments(filter),
    ]);

    const formatted = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: toContentPreview(p.content),
      isAnonymous: p.isAnonymous,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      viewCount: p.viewCount ?? 0,
      createdAt: p.createdAt,
      boardName: p.boardId?.name,
      boardSlug: p.boardId?.slug,
      boardId: p.boardId?._id,
      nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
      thumbnail: p.images?.[0] ?? null, // 첫 번째 이미지
      city: p.city || '',
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/hot-by-board?limit=4&hours=48
// 게시판별 인기글 (각 board 최대 N개) — 인기 탭 섹션용
router.get('/hot-by-board', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    const hours = parseInt(req.query.hours) || 48;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const city = req.query.city?.trim() || '';
    const blocked = await getBlockedUserIds(req.user?.id);
    const blockedOids = blocked.map(id => new mongoose.Types.ObjectId(id));

    // 일반 게시판만 (학교 게시판 제외)
    const boards = await Board.find({ isUniversityBoard: false }).sort({ sortOrder: 1 });

    const sections = await Promise.all(
      boards.map(async (board) => {
        const posts = await Post.aggregate([
          { $match: { boardId: board._id, createdAt: { $gte: since }, hidden: { $ne: true }, autoHidden: { $ne: true }, ...(blockedOids.length ? { userId: { $nin: blockedOids } } : {}), ...(expandCity(city) ? { city: { $in: expandCity(city) } } : {}) } },
          { $addFields: { hotScore: { $add: [{ $multiply: ['$likeCount', 3] }, '$commentCount'] } } },
          { $sort: { hotScore: -1, createdAt: -1 } },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
        ]);

        if (posts.length === 0) return null;

        return {
          boardId: board._id,
          boardName: board.name,
          boardSlug: board.slug,
          posts: posts.map(p => ({
            id: p._id,
            title: p.title,
            content: toContentPreview(p.content),
            isAnonymous: p.isAnonymous,
            likeCount: p.likeCount,
            commentCount: p.commentCount,
            createdAt: p.createdAt,
            nickname: p.isAnonymous ? '익명' : (p.user?.[0]?.nickname ?? '탈퇴한 회원'),
          })),
        };
      })
    );

    res.json({ success: true, data: sections.filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/latest-by-board — 일반 게시판별 최근 글 1개
router.get('/latest-by-board', optionalAuth, async (req, res) => {
  try {
    const blocked = await getBlockedUserIds(req.user?.id);
    const baseFilter = blocked.length ? { userId: { $nin: blocked } } : {};
    const boards = await Board.find({ isUniversityBoard: false }).sort({ sortOrder: 1 });

    const result = await Promise.all(
      boards.map(async (board) => {
        const post = await Post.findOne({ boardId: board._id, ...baseFilter })
          .sort({ createdAt: -1 })
          .populate('userId', 'nickname')
          .lean();

        return {
          boardId: board._id,
          latest: post ? {
            id: post._id,
            title: post.title,
            createdAt: post.createdAt,
            likeCount: post.likeCount ?? 0,
            commentCount: post.commentCount ?? 0,
            nickname: post.isAnonymous ? '익명' : (post.userId?.nickname ?? '탈퇴한 회원'),
            thumbnail: post.images?.[0] ?? null,
          } : null,
        };
      })
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/home-sections — 홈 화면 섹션별 데이터 (자유/장터/구인 최신글)
router.get('/home-sections', optionalAuth, async (req, res) => {
  try {
    const blocked = await getBlockedUserIds(req.user?.id);
    const city = req.query.city?.trim() || '';
    const baseFilter = { hidden: { $ne: true }, autoHidden: { $ne: true } };
    if (blocked.length) baseFilter.userId = { $nin: blocked };

    // 로컬 게시판 (장터, 구인) — city 필터 적용
    const LOCAL_SLUGS = ['market', 'jobs', 'roomrent', 'meetup'];

    // 자유, 장터, 구인 게시판 조회
    const targetSlugs = ['free', 'market', 'jobs'];
    const boards = await Board.find({ slug: { $in: targetSlugs } });
    const boardMap = {};
    boards.forEach(b => { boardMap[b.slug] = b._id; });

    const fetchPosts = async (slug, limit) => {
      const boardId = boardMap[slug];
      if (!boardId) return [];
      const filter = { ...baseFilter, boardId };
      const cities = expandCity(city);
      if (cities && LOCAL_SLUGS.includes(slug)) filter.city = { $in: cities };
      const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'nickname avatar')
        .populate('boardId', 'name slug')
        .lean();
      return posts.map(p => ({
        id: p._id,
        title: p.title,
        content: toContentPreview(p.content),
        isAnonymous: p.isAnonymous,
        likeCount: p.likeCount ?? 0,
        commentCount: p.commentCount ?? 0,
        viewCount: p.viewCount ?? 0,
        createdAt: p.createdAt,
        boardName: p.boardId?.name,
        boardSlug: p.boardId?.slug,
        nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
        thumbnail: p.images?.[0] ?? null,
        city: p.city || '',
      }));
    };

    const [freePosts, marketPosts, jobsPosts] = await Promise.all([
      fetchPosts('free', 3),
      fetchPosts('market', 6),
      fetchPosts('jobs', 3),
    ]);

    res.json({ success: true, data: { freePosts, marketPosts, jobsPosts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/hot?page=1&limit=20
// 최근 48시간 게시글을 인기 점수(likeCount*3 + commentCount) 순으로 반환
router.get('/hot', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const city = req.query.city?.trim() || '';
    const blocked = await getBlockedUserIds(req.user?.id);
    const blockedOids = blocked.map(id => new mongoose.Types.ObjectId(id));
    // 학교 게시판 글은 인기글에서 제외
    const uniBoardIds = await Board.find({ isUniversityBoard: true }).distinct('_id');
    const matchBase = {
      createdAt: { $gte: since },
      hidden: { $ne: true },
      autoHidden: { $ne: true },
      groupId: null,
      ...(uniBoardIds.length ? { boardId: { $nin: uniBoardIds } } : {}),
      ...(blockedOids.length ? { userId: { $nin: blockedOids } } : {}),
      ...(expandCity(city) ? { city: { $in: expandCity(city) } } : {}),
    };

    const [posts, total] = await Promise.all([
      Post.aggregate([
        { $match: matchBase },
        { $addFields: { hotScore: { $add: [{ $multiply: ['$likeCount', 3] }, '$commentCount'] } } },
        { $sort: { hotScore: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $lookup: {
            from: 'boards',
            localField: 'boardId',
            foreignField: '_id',
            as: 'board',
          },
        },
      ]),
      Post.countDocuments(matchBase),
    ]);

    const formatted = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: toContentPreview(p.content),
      isAnonymous: p.isAnonymous,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      boardName: p.board?.[0]?.name,
      boardId: p.board?.[0]?._id,
      nickname: p.isAnonymous ? '익명' : (p.user?.[0]?.nickname ?? '탈퇴한 회원'),
      hotScore: p.hotScore,
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/:postId
router.get('/:postId', optionalAuth, async (req, res) => {
  try {
    // 조회수 1 증가 후 업데이트된 doc 반환
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('userId', 'nickname avatarUrl role')
      .populate('boardId', 'name slug')
      .populate('groupId', 'name');

    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    // 모임 글: 멤버만 열람 가능
    if (post.groupId) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: '모임 멤버만 볼 수 있어요.' });
      }
      const membership = await GroupMembership.findOne({
        groupId: post.groupId._id, userId: req.user.id, status: 'active',
      }).lean();
      if (!membership) {
        return res.status(403).json({ success: false, message: '모임 멤버만 볼 수 있어요.' });
      }
    }

    // 자동 숨김 게시글: 작성자 본인 외에는 접근 불가 (admin은 별도 라우트)
    if (post.autoHidden) {
      const isOwner = req.user && String(post.userId?._id || post.userId) === String(req.user.id);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: '신고 누적으로 숨김 처리된 게시글입니다.' });
      }
    }

    const liked = req.user ? post.likedBy.some(id => String(id) === String(req.user.id)) : false;
    const bookmarked = req.user ? !!(await Bookmark.findOne({ userId: req.user.id, postId: post._id })) : false;

    res.json({
      success: true,
      data: {
        id: post._id,
        title: post.title,
        content: post.content,
        isAnonymous: post.isAnonymous,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        liked,
        bookmarked,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        boardName: post.boardId?.name,
        boardSlug: post.boardId?.slug,
        boardId: post.boardId?._id,
        groupId: post.groupId?._id,
        groupName: post.groupId?.name,
        city: post.city ?? '',
        userId: post.isAnonymous ? null : post.userId?._id,
        nickname: post.isAnonymous ? '익명' : (post.userId?.nickname ?? '탈퇴한 회원'),
        role: post.isAnonymous ? null : post.userId?.role,
        avatarUrl: post.isAnonymous ? null : post.userId?.avatarUrl,
        images: post.images ?? [],
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/upload-image — 리치 에디터용 단일 이미지 업로드 (Cloudinary URL 반환)
router.post('/upload-image', requireAuth, uploadImages.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
    // multer-storage-cloudinary가 req.file.path에 Cloudinary URL을 넣어줌
    const url = req.file.path;
    res.json({ success: true, data: { url } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '업로드에 실패했습니다.' });
  }
});

// POST /api/posts (multipart/form-data — 이미지 최대 4장)
router.post('/', requireAuth, uploadImages.array('images', 5), async (req, res) => {
  try {
    const { boardId, groupId, title, content } = req.body;
    if ((!boardId && !groupId) || !title || !content) {
      return res.status(400).json({ success: false, message: '게시판 또는 모임, 제목, 내용을 모두 입력해주세요.' });
    }

    const banned = await containsBannedWord(`${title} ${content}`);
    if (banned) {
      return res.status(400).json({ success: false, code: 'BANNED_WORD', message: `금지어가 포함되어 있어요: ${banned}` });
    }

    const uploadedImageUrls = (req.files ?? []).map(f => f.path);
    // 리치 에디터 모드: content가 HTML이면 거기서 이미지 URL 추출
    const htmlImageUrls = /<img/i.test(content) ? extractImagesFromHtml(content) : [];
    const imageUrls = [...uploadedImageUrls, ...htmlImageUrls].slice(0, 10);

    let postData = {
      userId: req.user.id,
      title,
      content,
      images: imageUrls,
    };

    if (groupId) {
      // 모임 글: 멤버십 확인
      const membership = await GroupMembership.findOne({
        groupId, userId: req.user.id, status: 'active',
      }).lean();
      if (!membership) {
        return res.status(403).json({ success: false, message: '모임 멤버만 글을 쓸 수 있어요.' });
      }
      postData.groupId = groupId;
      postData.isAnonymous = false; // 모임 글은 실명
    } else {
      // 일반 게시판 글
      const board = await Board.findById(boardId).select('slug isAnonymousAllowed').lean();
      const isLocalBoard = board && LOCAL_BOARD_SLUGS.includes(board.slug);
      postData.boardId = boardId;
      postData.city = isLocalBoard ? (req.body.city?.trim() || '') : '';
      // 익명은 보드 설정이 결정 (클라 조작 방어): 익명 보드면 항상 true, 아니면 항상 false
      postData.isAnonymous = !!board?.isAnonymousAllowed;
    }

    const post = await Post.create(postData);

    if (groupId) {
      Group.findByIdAndUpdate(groupId, { $inc: { postCount: 1 } }).catch(() => {});
    }

    res.status(201).json({ success: true, data: { id: post._id, title: post.title } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/posts/:postId
// PUT /api/posts/:postId — 글 수정 (작성자만)
router.put('/:postId', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }

    const { title, content, keepImages } = req.body;
    if (title) post.title = title.trim();
    if (content) post.content = content.trim();

    // 리치 에디터 모드(HTML): content에서 이미지 URL 추출하여 갱신
    if (content && /<img/i.test(content)) {
      post.images = extractImagesFromHtml(content);
    } else if (content !== undefined) {
      // 본문이 텍스트만 → 이미지 없음
      post.images = [];
    }

    // 도시: 보드 slug 기준으로 로컬 보드만 저장 허용
    if (req.body.city !== undefined) {
      const board = await Board.findById(post.boardId).select('slug').lean();
      const isLocalBoard = board && LOCAL_BOARD_SLUGS.includes(board.slug);
      post.city = isLocalBoard ? (req.body.city?.trim() || '') : '';
    }

    await post.save();
    res.json({ success: true, data: { message: '수정되었습니다.' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

router.delete('/:postId', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    const wasGroup = post.groupId;
    await post.deleteOne();
    if (wasGroup) {
      Group.findByIdAndUpdate(wasGroup, { $inc: { postCount: -1 } }).catch(() => {});
    }
    res.json({ success: true, data: { message: '삭제되었습니다.' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/:postId/like
router.post('/:postId/like', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    const userId = req.user.id;
    const alreadyLiked = post.likedBy.includes(userId);

    if (alreadyLiked) {
      post.likedBy.pull(userId);
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      post.likedBy.push(userId);
      post.likeCount += 1;

      // 자기 글이 아닐 때만 알림 발송
      if (String(post.userId) !== String(userId)) {
        const [liker, postOwner] = await Promise.all([
          User.findById(userId).select('nickname'),
          User.findById(post.userId).select('pushToken notificationSettings'),
        ]);
        const likerName = post.isAnonymous ? '익명' : (liker?.nickname ?? '누군가');

        // DB 알림 저장
        await Notification.create({
          userId: post.userId,
          type: 'like',
          refId: post._id,
          postId: post._id,
          message: `"${post.title.slice(0, 20)}" 글에 좋아요를 받았어요`,
        });

        // 푸시 알림 발송
        const ns = postOwner?.notificationSettings;
        if (postOwner?.pushToken && ns?.enabled !== false && ns?.like !== false) {
          sendPush(
            postOwner.pushToken,
            '좋아요 ♥',
            `${likerName}님이 회원님의 글을 좋아해요`,
            { type: 'like', postId: String(post._id) },
            postOwner._id,
          );
        }
      }
    }
    await post.save();

    res.json({ success: true, data: { liked: !alreadyLiked, likeCount: post.likeCount } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/:postId/bookmark — 북마크 토글
router.post('/:postId/bookmark', requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const existing = await Bookmark.findOne({ userId, postId });
    if (existing) {
      await existing.deleteOne();
      return res.json({ success: true, data: { bookmarked: false } });
    }
    await Bookmark.create({ userId, postId });
    res.json({ success: true, data: { bookmarked: true } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/:postId/comments
router.get('/:postId/comments', optionalAuth, async (req, res) => {
  try {
    // 잠금 댓글 마스킹을 위해 게시글 작성자 id 조회
    const post = await Post.findById(req.params.postId).select('userId');
    const requesterId = req.user?.id ? String(req.user.id) : null;
    const postAuthorId = post?.userId ? String(post.userId) : null;

    const blocked = await getBlockedUserIds(req.user?.id);
    const commentFilter = { postId: req.params.postId, autoHidden: { $ne: true } };
    if (blocked.length) commentFilter.userId = { $nin: blocked };

    const comments = await Comment.find(commentFilter)
      .sort({ isPinned: -1, createdAt: 1 }) // 고정 댓글 먼저
      .populate('userId', 'nickname avatarUrl');

    // 트리 구조 빌드
    const topLevel = [];
    const replyMap = {};

    comments.forEach(c => {
      const commentAuthorId = c.userId?._id ? String(c.userId._id) : null;
      // 잠금 댓글: 댓글 작성자 또는 게시글 작성자만 열람 가능
      const canSee = !c.isSecret ||
        (requesterId && (requesterId === commentAuthorId || requesterId === postAuthorId));

      const item = canSee ? {
        id: c._id,
        content: c.content,
        isAnonymous: c.isAnonymous,
        isSecret: c.isSecret ?? false,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        parentId: c.parentId,
        userId: c.userId?._id,        // 항상 포함 (클라이언트에서 권한 확인용)
        nickname: c.isAnonymous ? '익명' : (c.userId?.nickname ?? '탈퇴한 회원'),
        avatarUrl: c.isAnonymous ? null : c.userId?.avatarUrl,
        isPinned: c.isPinned ?? false,
        replies: [],
      } : {
        // 잠금 댓글 — 내용 마스킹
        id: c._id,
        isSecretMasked: true,
        createdAt: c.createdAt,
        parentId: c.parentId,
        isPinned: c.isPinned ?? false,
        replies: [],
      };

      if (!c.parentId) {
        topLevel.push(item);
      } else {
        const key = String(c.parentId);
        if (!replyMap[key]) replyMap[key] = [];
        replyMap[key].push(item);
      }
    });

    topLevel.forEach(c => {
      c.replies = replyMap[String(c.id)] || [];
    });

    res.json({ success: true, data: topLevel });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/posts/:postId/comments/:commentId/pin — 댓글 고정 토글 (게시글 작성자만)
router.put('/:postId/comments/:commentId/pin', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '게시글 작성자만 댓글을 고정할 수 있어요.' });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });

    // 이미 고정된 댓글이면 해제, 아니면 고정 (1개만 고정 가능)
    if (comment.isPinned) {
      comment.isPinned = false;
      await comment.save();
      return res.json({ success: true, data: { isPinned: false } });
    }

    // 기존 고정 댓글 해제 후 새로 고정
    await Comment.updateMany({ postId: req.params.postId, isPinned: true }, { isPinned: false });
    comment.isPinned = true;
    await comment.save();

    res.json({ success: true, data: { isPinned: true } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/:postId/comments
router.post('/:postId/comments', requireAuth, async (req, res) => {
  try {
    const { content, isAnonymous, parentId, isSecret } = req.body;
    if (!content) return res.status(400).json({ success: false, message: '댓글 내용을 입력해주세요.' });

    const banned = await containsBannedWord(content);
    if (banned) {
      return res.status(400).json({ success: false, code: 'BANNED_WORD', message: `금지어가 포함되어 있어요: ${banned}` });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    // 익명은 보드 설정에 따라 강제: 익명 보드면 true, 아니면 false (클라 조작 방어)
    const board = await Board.findById(post.boardId).select('isAnonymousAllowed').lean();
    const enforcedIsAnonymous = !!board?.isAnonymousAllowed;

    const comment = await Comment.create({
      postId: req.params.postId,
      userId: req.user.id,
      parentId: parentId || null,
      content,
      isAnonymous: enforcedIsAnonymous,
      isSecret: isSecret || false,
    });

    await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentCount: 1 } });

    // 자기 글에 자기 댓글 제외하고 알림 발송
    if (String(post.userId) !== String(req.user.id)) {
      const [commenter, postOwner] = await Promise.all([
        User.findById(req.user.id).select('nickname'),
        User.findById(post.userId).select('pushToken notificationSettings'),
      ]);
      const commenterName = enforcedIsAnonymous ? '익명' : (commenter?.nickname ?? '누군가');

      // DB 알림 저장
      await Notification.create({
        userId: post.userId,
        type: 'comment',
        refId: comment._id,
        postId: post._id,
        message: `${commenterName}님이 댓글을 남겼어요: "${content.slice(0, 30)}"`,
      });

      // 푸시 알림 발송
      const ns2 = postOwner?.notificationSettings;
      if (postOwner?.pushToken && ns2?.enabled !== false && ns2?.comment !== false) {
        sendPush(
          postOwner.pushToken,
          '새 댓글 💬',
          `${commenterName}: ${content.slice(0, 50)}`,
          { type: 'comment', postId: String(post._id) },
          postOwner._id,
        );
      }
    }

    res.status(201).json({ success: true, data: { id: comment._id } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/posts/:postId/comments/:commentId — 댓글 삭제 (댓글 작성자만)
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
    if (!comment.userId.equals(req.user.id)) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }
    await comment.deleteOne();
    await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentCount: -1 } });
    res.json({ success: true, data: { message: '삭제되었습니다.' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PATCH /api/posts/:postId/comments/:commentId — 댓글 수정 (작성자만)
router.patch('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: '내용을 입력해주세요.' });
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
    if (!comment.userId || !comment.userId.equals(req.user.id)) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }
    comment.content = content.trim();
    await comment.save();
    res.json({ success: true, data: { message: '수정되었습니다.' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
