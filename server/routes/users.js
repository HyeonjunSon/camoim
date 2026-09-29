const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const User = require('../models/User');
const Post = require('../models/Post');
const Board = require('../models/Board');
const Block = require('../models/Block');
const Bookmark = require('../models/Bookmark');
const { TRADE_BOARD_SLUGS } = require('../constants/boards');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Cloudinary avatar upload settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }],
  },
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 8 * 1024 * 1024 } });

// POST /api/users/me/avatar
router.post('/me/avatar', requireAuth, uploadAvatar.single('image'), async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ success: false, message: '이미지를 업로드하지 못했습니다.' });
    }
    const avatarUrl = req.file.path;
    await User.findByIdAndUpdate(req.user.id, { avatarUrl });
    res.json({ success: true, data: { avatarUrl } });
  } catch (err) {
    console.error('[users] avatar upload error:', err);
    res.status(500).json({ success: false, message: '아바타 업로드 중 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/posts
router.get('/me/posts', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('boardId', 'name slug'),
      Post.countDocuments({ userId: req.user.id }),
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
      boardId: p.boardId?._id,
      boardSlug: p.boardId?.slug,
      groupId: p.groupId,
      tradeStatus: p.tradeStatus || 'selling',
      thumbnail: p.images?.[0] ?? null,
      nickname: p.isAnonymous ? '익명' : req.user.nickname,
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/liked-posts — posts I liked
router.get('/me/liked-posts', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const filter = { likedBy: req.user.id };
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
      content: p.content,
      isAnonymous: p.isAnonymous,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      boardName: p.boardId?.name,
      boardId: p.boardId?._id,
      boardSlug: p.boardId?.slug,
      groupId: p.groupId,
      tradeStatus: p.tradeStatus || 'selling',
      nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
      thumbnail: p.images?.[0] ?? null,
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/bookmarks — posts I bookmarked
router.get('/me/bookmarks', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      Bookmark.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bookmark.countDocuments({ userId: req.user.id }),
    ]);

    const postIds = bookmarks.map(b => b.postId);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('userId', 'nickname')
      .populate('boardId', 'name slug');

    // Preserve the bookmark order
    const postMap = {};
    posts.forEach(p => { postMap[String(p._id)] = p; });

    const formatted = postIds
      .map(id => postMap[String(id)])
      .filter(Boolean)
      .map(p => ({
        id: p._id,
        title: p.title,
        content: p.content,
        isAnonymous: p.isAnonymous,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        boardName: p.boardId?.name,
        boardId: p.boardId?._id,
        boardSlug: p.boardId?.slug,
        groupId: p.groupId,
        tradeStatus: p.tradeStatus || 'selling',
        nickname: p.isAnonymous ? '익명' : (p.userId?.nickname ?? '탈퇴한 회원'),
        thumbnail: p.images?.[0] ?? null,
      }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/users/me
router.put('/me', requireAuth, async (req, res) => {
  try {
    // The school field is not accepted here — user.university is set only through the verification flow (an approved VerifyRequest)
    const { nickname, location, bio, role, city } = req.body;
    const update = {};
    if (nickname) {
      const dup = await User.findOne({ nickname, _id: { $ne: req.user.id } });
      if (dup) {
        return res.status(409).json({ success: false, message: '이미 사용 중인 닉네임입니다.' });
      }
      update.nickname = nickname;
    }
    if (location !== undefined) update.location = location;
    if (bio !== undefined) update.bio = bio;
    if (city !== undefined) update.city = city;

    // Role update: prevent self-promotion to admin
    if (role !== undefined) {
      if (role === 'admin') {
        return res.status(403).json({ success: false, message: '관리자 역할은 직접 설정할 수 없습니다.' });
      }
      const allowedRoles = ['student', 'working_holiday', 'general'];
      if (allowedRoles.includes(role)) {
        update.role = role;
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-passwordHash');
    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        location: user.location,
        school: user.school,
        bio: user.bio,
        role: user.role,
        verified: user.verified,
        university: user.university,
        city: user.city,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: '이미 사용 중인 닉네임입니다.' });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/notifications — read notification settings
router.get('/me/notifications', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationSettings');
    res.json({ success: true, data: user.notificationSettings });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PATCH /api/users/me/notifications — update notification settings
router.patch('/me/notifications', requireAuth, async (req, res) => {
  try {
    const allowed = ['enabled', 'comment', 'reply', 'like', 'chat', 'notice'];
    const update = {};
    for (const k of allowed) {
      if (typeof req.body[k] === 'boolean') {
        update[`notificationSettings.${k}`] = req.body[k];
      }
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('notificationSettings');
    res.json({ success: true, data: user.notificationSettings });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/users/me/push-token — register or refresh the Expo push token
router.put('/me/push-token', requireAuth, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ success: false, message: 'pushToken이 필요합니다.' });
    await User.findByIdAndUpdate(req.user.id, { pushToken });
    res.json({ success: true });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/blocks — users I blocked
router.get('/me/blocks', requireAuth, async (req, res) => {
  try {
    const blocks = await Block.find({ blockerId: req.user.id })
      .populate('blockedId', 'nickname avatarUrl')
      .sort({ createdAt: -1 });
    const data = blocks.map(b => ({
      id: b._id,
      blockedId: b.blockedId?._id,
      nickname: b.blockedId?.nickname,
      avatarUrl: b.blockedId?.avatarUrl,
      blockChat: b.blockChat,
      hideContent: b.hideContent,
      createdAt: b.createdAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/:userId/block-status — my block state toward a given user
router.get('/:userId/block-status', requireAuth, async (req, res) => {
  try {
    const block = await Block.findOne({
      blockerId: req.user.id,
      blockedId: req.params.userId,
    });
    res.json({
      success: true,
      data: block
        ? { blocked: true, blockChat: block.blockChat, hideContent: block.hideContent }
        : { blocked: false, blockChat: false, hideContent: false },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/users/:userId/block — create or update a block (both false lifts it)
router.put('/:userId/block', requireAuth, async (req, res) => {
  try {
    const { blockChat = true, hideContent = true } = req.body;
    if (String(req.params.userId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '자기 자신을 차단할 수 없습니다.' });
    }
    const target = await User.findById(req.params.userId).select('_id role');
    if (!target) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: '관리자는 차단할 수 없습니다.' });
    }

    // Both false means unblock
    if (!blockChat && !hideContent) {
      await Block.deleteOne({ blockerId: req.user.id, blockedId: req.params.userId });
      return res.json({ success: true, data: { blocked: false, blockChat: false, hideContent: false } });
    }

    const block = await Block.findOneAndUpdate(
      { blockerId: req.user.id, blockedId: req.params.userId },
      { $set: { blockChat: !!blockChat, hideContent: !!hideContent } },
      { new: true, upsert: true },
    );
    res.json({
      success: true,
      data: { blocked: true, blockChat: block.blockChat, hideContent: block.hideContent },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/users/:userId/block — lift the block entirely
router.delete('/:userId/block', requireAuth, async (req, res) => {
  try {
    await Block.deleteOne({ blockerId: req.user.id, blockedId: req.params.userId });
    res.json({ success: true, data: { blocked: false } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/:userId — profile plus their posts
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-passwordHash -email -pushToken');
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const posts = await Post.find({ userId: req.params.userId, isAnonymous: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('boardId', 'name');

    const formattedPosts = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: p.content,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      boardName: p.boardId?.name,
      thumbnail: p.images?.[0] ?? null,
    }));

    // ── Trade reputation — how many of the user's trade posts reached the sold state
    // (market, giveaway, car and roomrent all count as trade boards)
    const tradeBoards = await Board.find({ slug: { $in: TRADE_BOARD_SLUGS } }).select('_id').lean();
    const tradeBoardIds = tradeBoards.map(b => b._id);
    const tradeSoldCount = await Post.countDocuments({
      userId: req.params.userId,
      boardId: { $in: tradeBoardIds },
      tradeStatus: 'sold',
      isAnonymous: false,
    });

    res.json({
      success: true,
      data: {
        id: user._id,
        nickname: user.nickname,
        bio: user.bio,
        role: user.role,
        school: user.school,
        city: user.city,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        verified: !!user.verified,
        university: user.university || '',
        tradeSoldCount,
        posts: formattedPosts,
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
