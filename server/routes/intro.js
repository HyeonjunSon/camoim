// Intro board — fully anonymous introductions, open to any logged-in member (19+ self-attested).
// GET /                 browse (filters: gender, region, minBirthYear, maxBirthYear, proxyOnly)
// POST /                create (self or proxy-with-consent)
// GET /mine             my own posts (active + expired)
// GET /meta             { agreed, dailyRemaining, defaults }
// POST /agree           one-time 19+/rules self-attest
// GET /:id              detail (contact hidden unless owner or an accepted requester)
// DELETE /:id           close my own post early
// POST /:id/requests    apply to chat
// GET /requests/received   pending requests across my own posts
// PUT /requests/:id/accept   owner accepts — reveals contact + opens an anonymous chat
// PUT /requests/:id/decline  owner declines — the requester is never told
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const IntroPost = require('../models/IntroPost');
const IntroRequest = require('../models/IntroRequest');
const ChatRoom = require('../models/ChatRoom');
const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../utils/push');
const { getBlockedUserIds } = require('../utils/blocks');
const { INTRO_GENDERS, INTRO_JOBS, INTRO_CONTACT_TYPES, INTRO_EXPIRY_DAYS } = IntroPost;

const router = express.Router();

const DAILY_REQUEST_LIMIT = 10;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/intro',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    transformation: [{ width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Region is free text now, so browse filters by substring instead of an exact match
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same normalization idea as routes/universities.js's normalizeCommunityField, scoped to just Instagram
function normalizeContact(contactType, raw) {
  const s = String(raw || '').trim();
  if (!s || contactType !== 'instagram') return s;
  const handle = s.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  return handle;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function dailyRemainingFor(userId) {
  const used = await IntroRequest.countDocuments({ requesterId: userId, createdAt: { $gte: startOfToday() } });
  return Math.max(0, DAILY_REQUEST_LIMIT - used);
}

// Never includes userId/nickname — this board is anonymous end to end.
function formatIntro(p, { viewerId, showContact } = {}) {
  const daysLeft = Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - Date.now()) / 86_400_000));
  return {
    id: p._id,
    mode: p.mode,
    gender: p.gender,
    birthYear: p.birthYear,
    region: p.region,
    job: p.job || '',
    height: p.height || '',
    headline: p.headline,
    bio: p.bio || '',
    photo: p.photo || '',
    preferredBirthYearMin: p.preferredBirthYearMin ?? null,
    preferredBirthYearMax: p.preferredBirthYearMax ?? null,
    preferredRegion: p.preferredRegion || '',
    hasContact: !!(p.contactType && p.contactValue),
    contactType: showContact ? p.contactType : '',
    contactValue: showContact ? p.contactValue : '',
    status: p.status,
    expired: p.status === 'active' && new Date(p.expiresAt).getTime() <= Date.now(),
    daysLeft,
    isMine: viewerId ? String(p.userId) === String(viewerId) : false,
    createdAt: p.createdAt,
  };
}

router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '이미지가 없습니다.' });
  res.json({ success: true, url: req.file.path });
});

// ── GET /api/intro/meta ──
router.get('/meta', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('introAgreedAt introDefaults').lean();
    const dailyRemaining = await dailyRemainingFor(req.user.id);
    res.json({
      success: true,
      data: {
        agreed: !!user?.introAgreedAt,
        dailyRemaining,
        defaults: user?.introDefaults || {},
      },
    });
  } catch (err) {
    console.error('GET /intro/meta', err);
    res.status(500).json({ success: false, message: '정보를 불러오지 못했어요.' });
  }
});

// ── POST /api/intro/agree ──
router.post('/agree', requireAuth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $set: { introAgreedAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /intro/agree', err);
    res.status(500).json({ success: false, message: '처리에 실패했어요.' });
  }
});

// ── GET /api/intro ── browse ──
router.get('/', requireAuth, async (req, res) => {
  try {
    const { gender, region, minBirthYear, maxBirthYear, proxyOnly } = req.query;
    const filter = { status: 'active', expiresAt: { $gt: new Date() }, userId: { $ne: req.user.id } };
    if (INTRO_GENDERS.includes(gender)) filter.gender = gender;
    if (region) filter.region = { $regex: escapeRegex(String(region).trim()), $options: 'i' };
    if (proxyOnly === 'true') filter.mode = 'proxy';
    if (minBirthYear || maxBirthYear) {
      filter.birthYear = {};
      if (minBirthYear) filter.birthYear.$gte = Number(minBirthYear);
      if (maxBirthYear) filter.birthYear.$lte = Number(maxBirthYear);
    }

    const blocked = await getBlockedUserIds(req.user.id, 'hideContent');
    if (blocked.length) filter.userId.$nin = blocked.map((id) => new mongoose.Types.ObjectId(id));

    const list = await IntroPost.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, data: list.map((p) => formatIntro(p, { viewerId: req.user.id })) });
  } catch (err) {
    console.error('GET /intro', err);
    res.status(500).json({ success: false, message: '목록을 불러오지 못했어요.' });
  }
});

// ── GET /api/intro/mine ──
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const list = await IntroPost.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    const ids = list.map((p) => p._id);
    const pendingCounts = await IntroRequest.aggregate([
      { $match: { introPostId: { $in: ids }, status: 'pending' } },
      { $group: { _id: '$introPostId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(pendingCounts.map((c) => [String(c._id), c.count]));
    res.json({
      success: true,
      data: list.map((p) => ({
        ...formatIntro(p, { viewerId: req.user.id, showContact: true }),
        pendingCount: countMap.get(String(p._id)) || 0,
      })),
    });
  } catch (err) {
    console.error('GET /intro/mine', err);
    res.status(500).json({ success: false, message: '내 소개를 불러오지 못했어요.' });
  }
});

// ── POST /api/intro ── create ──
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('introAgreedAt').lean();
    if (!user?.introAgreedAt) {
      return res.status(403).json({ success: false, message: '이용 규칙 동의가 필요해요.' });
    }

    const b = req.body;
    if (!['self', 'proxy'].includes(b.mode)) return res.status(400).json({ success: false, message: '소개 유형을 선택해주세요.' });
    if (b.mode === 'proxy' && b.proxyConsent !== true) {
      return res.status(400).json({ success: false, message: '소개할 분의 동의가 필요해요.' });
    }
    if (!INTRO_GENDERS.includes(b.gender)) return res.status(400).json({ success: false, message: '성별을 선택해주세요.' });
    const birthYear = Number(b.birthYear);
    if (!Number.isFinite(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      return res.status(400).json({ success: false, message: '출생연도를 입력해주세요.' });
    }
    if (!b.region || !String(b.region).trim()) return res.status(400).json({ success: false, message: '지역을 선택해주세요.' });
    if (!b.headline || !String(b.headline).trim()) return res.status(400).json({ success: false, message: '한 줄 소개를 입력해주세요.' });

    const contactType = INTRO_CONTACT_TYPES.includes(b.contactType) ? b.contactType : '';
    const expiresAt = new Date(Date.now() + INTRO_EXPIRY_DAYS * 86_400_000);

    const doc = await IntroPost.create({
      userId: req.user.id,
      mode: b.mode,
      proxyConsent: b.mode === 'proxy' ? true : false,
      gender: b.gender,
      birthYear,
      region: String(b.region).trim().slice(0, 40),
      job: INTRO_JOBS.includes(b.job) ? b.job : '',
      height: String(b.height || '').trim().slice(0, 20),
      headline: String(b.headline).trim().slice(0, 60),
      bio: String(b.bio || '').trim().slice(0, 1000),
      // Number(null) is 0 (finite!), so null/undefined must be checked before the numeric coercion
      preferredBirthYearMin: b.preferredBirthYearMin != null && Number.isFinite(Number(b.preferredBirthYearMin)) ? Number(b.preferredBirthYearMin) : null,
      preferredBirthYearMax: b.preferredBirthYearMax != null && Number.isFinite(Number(b.preferredBirthYearMax)) ? Number(b.preferredBirthYearMax) : null,
      preferredRegion: String(b.preferredRegion || '').trim().slice(0, 40),
      contactType,
      contactValue: normalizeContact(contactType, b.contactValue).slice(0, 100),
      photo: typeof b.photo === 'string' ? b.photo.slice(0, 500) : '',
      expiresAt,
    });

    res.status(201).json({ success: true, data: formatIntro(doc, { viewerId: req.user.id, showContact: true }) });
  } catch (err) {
    console.error('POST /intro', err);
    res.status(500).json({ success: false, message: '등록에 실패했어요.' });
  }
});

// ── GET /api/intro/:id ──
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    const p = await IntroPost.findById(req.params.id).lean();
    if (!p || p.status === 'hidden') return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });

    const isOwner = String(p.userId) === String(req.user.id);
    let showContact = isOwner;
    let myRequestStatus = null;
    let myRoomId = null;
    if (!isOwner) {
      const myReq = await IntroRequest.findOne({ introPostId: p._id, requesterId: req.user.id })
        .sort({ createdAt: -1 }).select('status roomId').lean();
      myRequestStatus = myReq?.status || null;
      showContact = myReq?.status === 'accepted';
      myRoomId = myReq?.roomId || null;
    }

    res.json({ success: true, data: { ...formatIntro(p, { viewerId: req.user.id, showContact }), myRequestStatus, myRoomId } });
  } catch (err) {
    console.error('GET /intro/:id', err);
    res.status(500).json({ success: false, message: '소개글을 불러오지 못했어요.' });
  }
});

// ── DELETE /api/intro/:id ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    const p = await IntroPost.findById(req.params.id).select('userId');
    if (!p) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    if (String(p.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '삭제 권한이 없어요.' });
    }
    p.status = 'closed';
    await p.save();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /intro/:id', err);
    res.status(500).json({ success: false, message: '삭제에 실패했어요.' });
  }
});

// ── POST /api/intro/:id/requests ── apply to chat ──
router.post('/:id/requests', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    const user = await User.findById(req.user.id).select('introAgreedAt');
    if (!user?.introAgreedAt) return res.status(403).json({ success: false, message: '이용 규칙 동의가 필요해요.' });

    const post = await IntroPost.findById(req.params.id).select('userId status expiresAt');
    if (!post || post.status !== 'active' || post.expiresAt.getTime() <= Date.now()) {
      return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    }
    if (String(post.userId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '본인 글에는 신청할 수 없어요.' });
    }

    const existing = await IntroRequest.findOne({
      introPostId: post._id, requesterId: req.user.id, status: { $in: ['pending', 'accepted'] },
    });
    if (existing) return res.status(400).json({ success: false, message: '이미 신청한 소개글이에요.' });

    const remaining = await dailyRemainingFor(req.user.id);
    if (remaining <= 0) return res.status(429).json({ success: false, message: '오늘 신청 가능 횟수를 모두 사용했어요.' });

    const message = String(req.body.message || '').trim().slice(0, 150);
    if (!message) return res.status(400).json({ success: false, message: '한마디를 입력해주세요.' });

    const snapshot = {
      gender: INTRO_GENDERS.includes(req.body.gender) ? req.body.gender : '',
      birthYear: Number.isFinite(Number(req.body.birthYear)) ? Number(req.body.birthYear) : null,
      region: String(req.body.region || '').trim().slice(0, 40),
      job: INTRO_JOBS.includes(req.body.job) ? req.body.job : '',
    };

    const created = await IntroRequest.create({
      introPostId: post._id, requesterId: req.user.id, message, snapshot,
    });
    await User.updateOne({ _id: req.user.id }, { $set: { introDefaults: snapshot } });

    const owner = await User.findById(post.userId).select('pushToken notificationSettings');
    await Notification.create({
      userId: post.userId, type: 'intro_request', postId: post._id,
      message: '소개팅 글에 새 대화 신청이 왔어요. 수락하면 채팅이 열려요.',
    });
    const ns = owner?.notificationSettings;
    if (owner?.pushToken && ns?.enabled !== false) {
      sendPush(owner.pushToken, 'CaMoim', '소개팅 글에 새 대화 신청이 왔어요', { type: 'intro_request' }, owner._id);
    }

    res.status(201).json({ success: true, data: { id: created._id, dailyRemaining: remaining - 1 } });
  } catch (err) {
    console.error('POST /intro/:id/requests', err);
    res.status(500).json({ success: false, message: '신청에 실패했어요.' });
  }
});

// ── GET /api/intro/requests/received ──
router.get('/requests/received', requireAuth, async (req, res) => {
  try {
    const myPosts = await IntroPost.find({ userId: req.user.id }).select('_id headline').lean();
    const postMap = new Map(myPosts.map((p) => [String(p._id), p.headline]));
    const reqs = await IntroRequest.find({ introPostId: { $in: [...postMap.keys()] }, status: 'pending' })
      .sort({ createdAt: -1 }).populate('requesterId', 'role verified createdAt').lean();

    const now = Date.now();
    const data = reqs.map((r) => {
      const requester = r.requesterId;
      const memberMonths = requester?.createdAt
        ? Math.max(0, Math.floor((now - new Date(requester.createdAt).getTime()) / (30 * 86_400_000)))
        : 0;
      return {
        id: r._id,
        introPostId: r.introPostId,
        introHeadline: postMap.get(String(r.introPostId)) || '',
        gender: r.snapshot?.gender || '',
        birthYear: r.snapshot?.birthYear || null,
        region: r.snapshot?.region || '',
        job: r.snapshot?.job || '',
        verificationBadge: requester?.role === 'student' && requester?.verified ? 'school' : (requester?.verified ? 'email' : ''),
        memberMonths,
        message: r.message,
        createdAt: r.createdAt,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /intro/requests/received', err);
    res.status(500).json({ success: false, message: '받은 신청을 불러오지 못했어요.' });
  }
});

// ── PUT /api/intro/requests/:id/accept ──
router.put('/requests/:id/accept', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '신청을 찾을 수 없어요.' });
    const reqDoc = await IntroRequest.findById(req.params.id);
    if (!reqDoc || reqDoc.status !== 'pending') return res.status(404).json({ success: false, message: '신청을 찾을 수 없어요.' });

    const post = await IntroPost.findById(reqDoc.introPostId);
    if (!post || String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }

    // A fresh, dedicated room per (post, requester) — never merged into any pre-existing
    // plain DM between these two users, so the intro-chat anonymity always holds.
    const room = await ChatRoom.create({
      kind: 'dm',
      participants: [post.userId, reqDoc.requesterId],
      status: 'accepted',
      requesterId: reqDoc.requesterId,
      introPostId: post._id,
    });

    reqDoc.status = 'accepted';
    reqDoc.roomId = room._id;
    await reqDoc.save();

    const requester = await User.findById(reqDoc.requesterId).select('pushToken notificationSettings');
    await Notification.create({
      userId: reqDoc.requesterId, type: 'intro_accepted', postId: post._id, roomId: room._id,
      message: '소개팅 신청이 수락됐어요. 연락처가 공개됐어요.',
    });
    const ns = requester?.notificationSettings;
    if (requester?.pushToken && ns?.enabled !== false) {
      sendPush(requester.pushToken, 'CaMoim', '소개팅 신청이 수락됐어요', { type: 'intro_accepted' }, requester._id);
    }

    res.json({ success: true, data: { roomId: room._id } });
  } catch (err) {
    console.error('PUT /intro/requests/:id/accept', err);
    res.status(500).json({ success: false, message: '수락에 실패했어요.' });
  }
});

// ── PUT /api/intro/requests/:id/decline ── the requester is never notified ──
router.put('/requests/:id/decline', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '신청을 찾을 수 없어요.' });
    const reqDoc = await IntroRequest.findById(req.params.id);
    if (!reqDoc || reqDoc.status !== 'pending') return res.status(404).json({ success: false, message: '신청을 찾을 수 없어요.' });

    const post = await IntroPost.findById(reqDoc.introPostId).select('userId');
    if (!post || String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    reqDoc.status = 'declined';
    await reqDoc.save();
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /intro/requests/:id/decline', err);
    res.status(500).json({ success: false, message: '처리에 실패했어요.' });
  }
});

// ── POST /api/intro/:id/report ──
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });
    const post = await IntroPost.findById(req.params.id).select('_id userId').populate('userId', 'nickname');
    if (!post) return res.status(404).json({ success: false, message: '소개글을 찾을 수 없어요.' });

    const reason = ['spam', 'hate', 'illegal', 'adult', 'etc'].includes(req.body.reason) ? req.body.reason : 'etc';
    try {
      await Report.create({
        reporterId: req.user.id, targetType: 'intro', targetId: post._id, reason, detail: req.body.detail || '',
        // Snapshot for admin review — the intro board never shows a nickname to other members, so
        // this is the only way an admin can see who posted it (kept even if the account is later deleted)
        targetAuthorId: post.userId?._id || null,
        targetAuthorNickname: post.userId?.nickname || '',
        targetIsAnonymous: true,
      });
      const r = await IntroPost.findByIdAndUpdate(post._id, { $inc: { reportCount: 1 } }, { new: true }).select('reportCount');
      if (r && r.reportCount >= 5) await IntroPost.updateOne({ _id: post._id }, { $set: { autoHidden: true, status: 'hidden' } });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
    res.json({ success: true, message: '신고가 접수되었어요.' });
  } catch (err) {
    console.error('POST /intro/:id/report', err);
    res.status(500).json({ success: false, message: '신고에 실패했어요.' });
  }
});

module.exports = router;
