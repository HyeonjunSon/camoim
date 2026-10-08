const express = require('express');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Board = require('../models/Board');
const University = require('../models/University');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Bookmark = require('../models/Bookmark');
const StayListing = require('../models/StayListing');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sendPush } = require('../utils/push');
const { getBlockedUserIds } = require('../utils/blocks');
const { getAllBoards } = require('../utils/boardCache');
const { containsBannedWord } = require('../middleware/systemGuard');
const mongoose = require('mongoose');

const { expandCity } = require('../utils/metro');
const { LOCAL_BOARD_SLUGS, TRADE_BOARD_SLUGS } = require('../constants/boards');
const { toContentPreview } = require('../utils/contentPreview');

const router = express.Router();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Pull <img src="..."> out of the HTML content for thumbnails and the image list
function extractImagesFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches.map(m => m[1]).slice(0, 10);
}

// ── Cloudinary upload settings (up to 5 images, 10MB each)
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

// GET /api/posts?search=keyword&limit=20 — search posts
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, limit: limitQ } = req.query;
    const limit = parseInt(limitQ) || 20;

    if (!search?.trim()) return res.json({ success: true, data: [] });

    const blocked = await getBlockedUserIds(req.user?.id);
    // School board posts are excluded from search
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

    // School board posts are excluded from the home feed
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
      thumbnail: p.images?.[0] ?? null, // First image
      city: p.city || '',
      tradeStatus: p.tradeStatus || 'selling',
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// Join only the author's nickname — project so the whole user document (passwordHash and friends) never comes along
// (the let/$expr form, compatible with MongoDB 3.6+)
const LOOKUP_AUTHOR_NICKNAME = {
  $lookup: {
    from: 'users',
    let: { uid: '$userId' },
    pipeline: [
      { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
      { $project: { nickname: 1 } },
    ],
    as: 'author',
  },
};

// GET /api/posts/hot-by-board?limit=4&hours=48[&top=5]
// Hot posts per board (at most `limit` each) — powers the home hot section
//
// Performance: this used to be one board-list query plus one aggregate per board (13 of them).
// That exceeded the connection pool (10), so some queries queued. Now boards come from cache and posts take one aggregate.
//
// top: the app flattens every board and keeps only the 5 highest hotScore entries. When top is given the server
// returns just those N (the response shape is unchanged, so older clients omitting top still work).
// The selection rule matches the app exactly: cut to `limit` per board, flatten in board order,
// stable-sort by hotScore, then take the first N.
router.get('/hot-by-board', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 4, 20);
    const hours = parseInt(req.query.hours) || 48;
    const top = parseInt(req.query.top) || 0;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const city = req.query.city?.trim() || '';
    const cities = expandCity(city);

    const [blocked, allBoards] = await Promise.all([
      getBlockedUserIds(req.user?.id),
      getAllBoards(),
    ]);
    // General boards only (school boards excluded) — equivalent to the old { isUniversityBoard: false } query
    const boards = allBoards.filter((b) => b.isUniversityBoard === false);
    const boardIds = boards.map((b) => b._id);
    // aggregate does no Mongoose casting, so IDs must be converted to ObjectId for the block filter to bite
    const blockedOids = blocked.map((id) => new mongoose.Types.ObjectId(id));

    const rows = await Post.aggregate([
      { $match: {
        boardId: { $in: boardIds },
        createdAt: { $gte: since },
        hidden: { $ne: true },
        autoHidden: { $ne: true },
        ...(blockedOids.length ? { userId: { $nin: blockedOids } } : {}),
        ...(cities ? { city: { $in: cities } } : {}),
      } },
      { $project: {
        boardId: 1, userId: 1, title: 1, content: 1, isAnonymous: 1,
        likeCount: 1, commentCount: 1, createdAt: 1,
        hotScore: { $add: [{ $multiply: [{ $ifNull: ['$likeCount', 0] }, 3] }, { $ifNull: ['$commentCount', 0] }] },
      } },
      { $sort: { hotScore: -1, createdAt: -1 } },
      // Group by board in sorted order, then take the first `limit` ($push preserves input order)
      { $group: { _id: '$boardId', posts: { $push: '$$ROOT' } } },
      { $project: { posts: { $slice: ['$posts', limit] } } },
      { $unwind: '$posts' },
      { $replaceRoot: { newRoot: '$posts' } },
      LOOKUP_AUTHOR_NICKNAME,
    ]);

    // Sections follow board order (sortOrder); within a section, hotScore order
    const byBoard = new Map();
    for (const p of rows) {
      const k = String(p.boardId);
      if (!byBoard.has(k)) byBoard.set(k, []);
      byBoard.get(k).push(p);
    }
    const rank = (a, b) => (b.hotScore - a.hotScore) || (b.createdAt - a.createdAt);
    let sections = boards
      .map((board) => ({ board, posts: (byBoard.get(String(board._id)) || []).sort(rank) }))
      .filter((s) => s.posts.length > 0);

    if (top > 0) {
      // Same approach as the app: flatten in board order, stable-sort by hotScore, take the first `top`
      const winners = new Set(
        sections
          .flatMap((s) => s.posts)
          .sort((a, b) => b.hotScore - a.hotScore) // Array.prototype.sort is a stable sort
          .slice(0, top)
          .map((p) => String(p._id))
      );
      sections = sections
        .map((s) => ({ ...s, posts: s.posts.filter((p) => winners.has(String(p._id))) }))
        .filter((s) => s.posts.length > 0);
    }

    res.json({
      success: true,
      data: sections.map(({ board, posts }) => ({
        boardId: board._id,
        boardName: board.name,
        boardSlug: board.slug,
        posts: posts.map((p) => ({
          id: p._id,
          title: p.title,
          content: toContentPreview(p.content),
          isAnonymous: p.isAnonymous,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
          nickname: p.isAnonymous ? '익명' : (p.author?.[0]?.nickname ?? '탈퇴한 회원'),
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/posts/latest-by-board — the single latest post per general board
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

// GET /api/posts/home-sections — per-section home data (free board, marketplace, jobs)
//
// Performance: this used to hit the DB four times serially — block list, boards, posts, then populate (author and board).
// Now the block list ‖ boards (cached) run together, and the three sections each take one aggregate (with $lookup)
// in parallel — two serial round trips, or one when the block list is already cached.
router.get('/home-sections', optionalAuth, async (req, res) => {
  try {
    const city = req.query.city?.trim() || '';
    const cities = expandCity(city);

    const [blocked, allBoards] = await Promise.all([
      getBlockedUserIds(req.user?.id),
      getAllBoards(),
    ]);
    const blockedOids = blocked.map((id) => new mongoose.Types.ObjectId(id));

    // Local boards (marketplace, jobs) — apply the city filter
    const LOCAL_SLUGS = ['market', 'jobs', 'roomrent', 'meetup'];
    const bySlug = new Map(allBoards.map((b) => [b.slug, b]));

    const fetchPosts = async (slug, limit) => {
      const board = bySlug.get(slug);
      if (!board) return [];
      const match = {
        boardId: board._id,
        hidden: { $ne: true },
        autoHidden: { $ne: true },
        ...(blockedOids.length ? { userId: { $nin: blockedOids } } : {}),
        ...(cities && LOCAL_SLUGS.includes(slug) ? { city: { $in: cities } } : {}),
      };
      const posts = await Post.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        LOOKUP_AUTHOR_NICKNAME,
      ]);
      return posts.map((p) => ({
        id: p._id,
        title: p.title,
        content: toContentPreview(p.content),
        isAnonymous: p.isAnonymous,
        likeCount: p.likeCount ?? 0,
        commentCount: p.commentCount ?? 0,
        viewCount: p.viewCount ?? 0,
        createdAt: p.createdAt,
        boardName: board.name,
        boardSlug: board.slug,
        nickname: p.isAnonymous ? '익명' : (p.author?.[0]?.nickname ?? '탈퇴한 회원'),
        thumbnail: p.images?.[0] ?? null,
        city: p.city || '',
        // Lets a client badge a sold item without a second request. Additive:
        // older app builds simply ignore it.
        tradeStatus: p.tradeStatus || 'selling',
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
// Posts from the last 48 hours, ranked by popularity (likeCount*3 + commentCount)
router.get('/hot', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const city = req.query.city?.trim() || '';
    const blocked = await getBlockedUserIds(req.user?.id);
    const blockedOids = blocked.map(id => new mongoose.Types.ObjectId(id));
    // School board posts are excluded from hot posts
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
    // Increment the view count and return the updated document
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('userId', 'nickname avatarUrl role')
      .populate('boardId', 'name slug')
      .populate('groupId', 'name');

    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    // Group posts: members only
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
      // Include the user's group role in the response so the frontend can tell owner/manager apart
      req._myGroupRole = membership.role;
    }

    // Auto-hidden posts are unreachable except by their author (admins have a separate route)
    if (post.autoHidden) {
      const isOwner = req.user && String(post.userId?._id || post.userId) === String(req.user.id);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: '신고 누적으로 숨김 처리된 게시글입니다.' });
      }
    }

    const liked = req.user ? post.likedBy.some(id => String(id) === String(req.user.id)) : false;
    const bookmarked = req.user ? !!(await Bookmark.findOne({ userId: req.user.id, postId: post._id })) : false;

    // On school boards, flag whether the author is the student president
    let authorIsLeader = false;
    if (post.boardId && !post.isAnonymous && post.userId) {
      const boardDoc = await Board.findById(post.boardId._id).select('isUniversityBoard university').lean();
      if (boardDoc?.isUniversityBoard && boardDoc.university) {
        const uni = await University.findOne({ name: boardDoc.university }).select('leaderUserId').lean();
        if (uni?.leaderUserId && String(uni.leaderUserId) === String(post.userId._id || post.userId)) {
          authorIsLeader = true;
        }
      }
    }

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
        myGroupRole: req._myGroupRole || null,
        pinned: !!post.pinned,
        tradeStatus: post.tradeStatus || 'selling',
        city: post.city ?? '',
        userId: post.isAnonymous ? null : post.userId?._id,
        // Real author id, kept distinct from the (possibly anonymized) userId above.
        // Used client-side only for ownership checks and the block/report actions —
        // never for display or profile navigation, so anonymity is preserved.
        // Guideline 1.2 requires blocking to work even on anonymous content.
        authorId: post.userId?._id ?? null,
        nickname: post.isAnonymous ? '익명' : (post.userId?.nickname ?? '탈퇴한 회원'),
        role: post.isAnonymous ? null : post.userId?.role,
        avatarUrl: post.isAnonymous ? null : post.userId?.avatarUrl,
        authorIsLeader,
        images: post.images ?? [],
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/upload-image — single image upload for the rich editor (returns a Cloudinary URL)
router.post('/upload-image', requireAuth, uploadImages.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
    // multer-storage-cloudinary puts the Cloudinary URL on req.file.path
    const url = req.file.path;
    res.json({ success: true, data: { url } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '업로드에 실패했습니다.' });
  }
});

// POST /api/posts (multipart/form-data — up to 4 images)
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
    // Rich editor mode: when content is HTML, extract the image URLs from it
    const htmlImageUrls = /<img/i.test(content) ? extractImagesFromHtml(content) : [];
    const imageUrls = [...uploadedImageUrls, ...htmlImageUrls].slice(0, 10);

    let postData = {
      userId: req.user.id,
      title,
      content,
      images: imageUrls,
    };

    if (groupId) {
      // Group posts: check membership
      const membership = await GroupMembership.findOne({
        groupId, userId: req.user.id, status: 'active',
      }).lean();
      if (!membership) {
        return res.status(403).json({ success: false, message: '모임 멤버만 글을 쓸 수 있어요.' });
      }
      postData.groupId = groupId;
      postData.isAnonymous = false; // Group posts are never anonymous
    } else {
      // General board post
      const board = await Board.findById(boardId).select('slug isAnonymousAllowed').lean();
      const isLocalBoard = board && LOCAL_BOARD_SLUGS.includes(board.slug);
      postData.boardId = boardId;
      postData.city = isLocalBoard ? (req.body.city?.trim() || '') : '';
      // Anonymity is decided by the board, not the client: always true on an anonymous board, always false otherwise
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
// PUT /api/posts/:postId — edit a post (author only)
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

    // Rich editor mode (HTML): refresh the image URLs from content
    if (content && /<img/i.test(content)) {
      post.images = extractImagesFromHtml(content);
    } else if (content !== undefined) {
      // Text-only body means no images
      post.images = [];
    }

    // City: stored only for local boards, decided by the board slug
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

    const isAuthor = String(post.userId) === String(req.user.id);
    // On group posts, the owner and managers may also delete
    let isGroupMod = false;
    if (post.groupId) {
      const m = await GroupMembership.findOne({
        groupId: post.groupId, userId: req.user.id, status: 'active',
      }).lean();
      isGroupMod = m && (m.role === 'owner' || m.role === 'manager');
    }

    if (!isAuthor && !isGroupMod) {
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

// PUT /api/posts/:postId/pin { pinned } — pin a group post (owner/manager only)
router.put('/:postId/pin', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
    if (!post.groupId) {
      return res.status(400).json({ success: false, message: '모임 글만 고정할 수 있어요.' });
    }
    const m = await GroupMembership.findOne({
      groupId: post.groupId, userId: req.user.id, status: 'active',
    }).lean();
    if (!m || (m.role !== 'owner' && m.role !== 'manager')) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    const pinned = !!req.body?.pinned;
    post.pinned = pinned;
    await post.save();
    res.json({ success: true, data: { pinned } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/posts/:postId/trade-status { status: 'selling' | 'sold' }
// Marketplace boards (market/giveaway/car/roomrent): only the author can toggle (admins too)
router.put('/:postId/trade-status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['selling', 'sold'].includes(status)) {
      return res.status(400).json({ success: false, message: '잘못된 상태에요.' });
    }
    const post = await Post.findById(req.params.postId).populate('boardId', 'slug');
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    const isAuthor = String(post.userId) === String(req.user.id);
    const me = await User.findById(req.user.id).select('role').lean();
    const isAdmin = me?.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }

    const slug = post.boardId?.slug;
    if (!slug || !TRADE_BOARD_SLUGS.includes(slug)) {
      return res.status(400).json({ success: false, message: '거래 상태를 변경할 수 있는 게시판이 아니에요.' });
    }

    post.tradeStatus = status;
    await post.save();

    // If this post spawned a map stay listing, keep its status in sync (filled to closed, available to active)
    StayListing.updateMany(
      { sourcePostId: post._id },
      { status: status === 'sold' ? 'closed' : 'active' }
    ).catch(() => {});

    res.json({ success: true, data: { tradeStatus: status } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/:postId/like
router.post('/:postId/like', requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    // Conditional atomic update for the toggle — findById, mutate, save() could lose a likeCount
    // or double-count the same user under concurrent requests.
    // The likedBy condition in the filter lets the DB decide "not yet liked" versus "already liked".
    const fields = 'userId title isAnonymous likeCount';
    const unliked = await Post.findOneAndUpdate(
      { _id: postId, likedBy: userId },
      { $pull: { likedBy: userId }, $inc: { likeCount: -1 } },
      { new: true, projection: fields }
    );
    const post = unliked || await Post.findOneAndUpdate(
      { _id: postId, likedBy: { $ne: userId } },
      { $addToSet: { likedBy: userId }, $inc: { likeCount: 1 } },
      { new: true, projection: fields }
    );
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
    const alreadyLiked = !!unliked;

    if (!alreadyLiked) {
      // Notify only when it is not the user's own post
      if (String(post.userId) !== String(userId)) {
        const [liker, postOwner] = await Promise.all([
          User.findById(userId).select('nickname'),
          User.findById(post.userId).select('pushToken notificationSettings'),
        ]);
        const likerName = post.isAnonymous ? '익명' : (liker?.nickname ?? '누군가');

        // Store the notification
        await Notification.create({
          userId: post.userId,
          type: 'like',
          refId: post._id,
          postId: post._id,
          message: `"${post.title.slice(0, 20)}" 글에 좋아요를 받았어요`,
        });

        // Send the push
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

    res.json({ success: true, data: { liked: !alreadyLiked, likeCount: Math.max(0, post.likeCount) } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/posts/:postId/bookmark — toggle the bookmark
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
    // Look up the post author's id so locked comments can be masked
    const post = await Post.findById(req.params.postId).select('userId');
    const requesterId = req.user?.id ? String(req.user.id) : null;
    const postAuthorId = post?.userId ? String(post.userId) : null;

    const blocked = await getBlockedUserIds(req.user?.id);
    const commentFilter = { postId: req.params.postId, autoHidden: { $ne: true } };
    if (blocked.length) commentFilter.userId = { $nin: blocked };

    const comments = await Comment.find(commentFilter)
      .sort({ isPinned: -1, createdAt: 1 }) // Pinned comments first
      .populate('userId', 'nickname avatarUrl');

    // Build the tree
    const topLevel = [];
    const replyMap = {};

    comments.forEach(c => {
      const commentAuthorId = c.userId?._id ? String(c.userId._id) : null;
      // Locked comments are readable only by their author and the post author
      const canSee = !c.isSecret ||
        (requesterId && (requesterId === commentAuthorId || requesterId === postAuthorId));

      // "Edited" marker — treat it as edited when updatedAt trails createdAt by more than 2 seconds
      // (mongoose's automatic timestamps differ by a few ms on create/save, hence the tolerance)
      const wasEdited = c.updatedAt && c.createdAt &&
        (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 2000);

      const item = canSee ? {
        id: c._id,
        content: c.content,
        isAnonymous: c.isAnonymous,
        isSecret: c.isSecret ?? false,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        edited: wasEdited,
        parentId: c.parentId,
        userId: c.userId?._id,        // Always included, so the client can check permissions
        nickname: c.isAnonymous ? '익명' : (c.userId?.nickname ?? '탈퇴한 회원'),
        avatarUrl: c.isAnonymous ? null : c.userId?.avatarUrl,
        isPinned: c.isPinned ?? false,
        replies: [],
      } : {
        // Locked comment — mask the body
        id: c._id,
        isSecretMasked: true,
        createdAt: c.createdAt,
        edited: wasEdited,
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

// PUT /api/posts/:postId/comments/:commentId/pin — toggle a pinned comment (post author only)
router.put('/:postId/comments/:commentId/pin', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });

    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '게시글 작성자만 댓글을 고정할 수 있어요.' });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });

    // Unpin if it is already pinned, otherwise pin it (only one comment can be pinned)
    if (comment.isPinned) {
      comment.isPinned = false;
      await comment.save();
      return res.json({ success: true, data: { isPinned: false } });
    }

    // Unpin the previous one, then pin this
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

    // Anonymity is forced by the board: true on an anonymous board, false otherwise (client cannot override)
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

    // Notifications:
    //  - a reply (parentId set) notifies only the parent comment's author (type 'reply'), never the post author.
    //  - a top-level comment notifies the post author (type 'comment').
    //  - never notify yourself.
    const commenter = await User.findById(req.user.id).select('nickname');
    const commenterName = enforcedIsAnonymous ? '익명' : (commenter?.nickname ?? '누군가');

    if (parentId) {
      // Reply — notify the parent comment's author only
      const parent = await Comment.findById(parentId).select('userId').lean();
      if (parent && String(parent.userId) !== String(req.user.id)) {
        const parentOwner = await User.findById(parent.userId).select('pushToken notificationSettings');

        await Notification.create({
          userId: parent.userId,
          type: 'reply',
          refId: comment._id,
          postId: post._id,
          message: `${commenterName}님이 답글을 남겼어요: "${content.slice(0, 30)}"`,
        });

        const ns = parentOwner?.notificationSettings;
        if (parentOwner?.pushToken && ns?.enabled !== false && ns?.reply !== false) {
          sendPush(
            parentOwner.pushToken,
            '새 답글 💬',
            `${commenterName}: ${content.slice(0, 50)}`,
            { type: 'reply', postId: String(post._id) },
            parentOwner._id,
          );
        }
      }
    } else if (String(post.userId) !== String(req.user.id)) {
      // Top-level comment — notify the post author
      const postOwner = await User.findById(post.userId).select('pushToken notificationSettings');

      await Notification.create({
        userId: post.userId,
        type: 'comment',
        refId: comment._id,
        postId: post._id,
        message: `${commenterName}님이 댓글을 남겼어요: "${content.slice(0, 30)}"`,
      });

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

// DELETE /api/posts/:postId/comments/:commentId — delete a comment (its author only)
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

// PATCH /api/posts/:postId/comments/:commentId — edit a comment (its author only)
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
