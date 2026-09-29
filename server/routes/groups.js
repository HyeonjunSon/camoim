// Groups — user-created, activated after admin approval
// A group is a board + (Phase 2) a group chat + memberships
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Cloudinary upload for group covers
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const coverStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'camoim/groups',
    allowed_formats: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    // Keep the original ratio, only shrinking to fit inside 1200x600 — the display letterboxes with contain
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const VALID_CATEGORIES = ['hobby', 'study', 'local', 'job', 'workinghol', 'general'];

// Check member permissions
async function getMyMembership(groupId, userId) {
  if (!userId) return null;
  return GroupMembership.findOne({ groupId, userId, status: { $in: ['active', 'pending'] } });
}
function canManage(membership) {
  return membership && (membership.role === 'owner' || membership.role === 'manager') && membership.status === 'active';
}
function isOwner(membership) {
  return membership && membership.role === 'owner' && membership.status === 'active';
}

// ── GET /api/groups — group list (search/filter) ───────
// ?box=all (default) | mine (only groups I joined)
// ?category=hobby&city=Toronto&q=keyword&sort=popular|recent
// ?university=University of Toronto (UofT) — school clubs only
// ?excludeUniversity=true — general groups only (school clubs excluded)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { box = 'all', category, city, q, sort = 'popular', university, excludeUniversity } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const skip = ((parseInt(req.query.page) || 1) - 1) * limit;

    let filter = { status: 'active' };
    if (category && VALID_CATEGORIES.includes(category)) filter.category = category;
    if (city) filter.city = city;
    if (university) filter.university = university;
    else if (excludeUniversity === 'true') filter.university = '';
    // In the default 'all' mode (not 'mine') with neither university nor excludeUniversity set,
    // show the groups a user may see and join, plus the ones they already belong to:
    //  - admin: everything
    //  - verified member: general groups + their own school's clubs + any group they already joined
    //  - everyone else (unverified or logged out): general groups + groups they joined
    // (already-joined groups must always appear regardless of school, or 'my groups' would not be a subset of 'all')
    if (!university && excludeUniversity !== 'true' && box !== 'mine') {
      let me = null;
      if (req.user) {
        me = await User.findById(req.user.id).select('verified university role').lean();
      }
      if (me?.role === 'admin') {
        // No filter — everything
      } else {
        const universityClause = (me?.verified && me?.university)
          ? { university: { $in: ['', me.university] } }
          : { university: '' };

        const myGroupIds = req.user
          ? await GroupMembership.find({
              userId: req.user.id,
              status: 'active',
            }).distinct('groupId')
          : [];

        if (myGroupIds.length > 0) {
          filter.$or = [universityClause, { _id: { $in: myGroupIds } }];
        } else {
          Object.assign(filter, universityClause);
        }
      }
    }
    if (q) {
      const safe = String(q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: safe, $options: 'i' };
    }

    if (box === 'mine') {
      if (!req.user) return res.json({ success: true, data: [] });
      const my = await GroupMembership.find({ userId: req.user.id, status: 'active' }).distinct('groupId');
      filter._id = { $in: my };
    }

    const sortObj = sort === 'recent'
      ? { createdAt: -1 }
      : { memberCount: -1, createdAt: -1 };

    const groups = await Group.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select('name description coverImage category city university ownerId memberCount postCount joinPolicy createdAt')
      .lean();

    res.json({ success: true, data: groups });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── POST /api/groups — apply for a group (pending_review) ──
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, coverImage, category, city, joinPolicy, schoolOnly } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: '모임 이름을 2자 이상 입력해주세요.' });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '카테고리를 선택해주세요.' });
    }
    if (joinPolicy && !['open', 'approval'].includes(joinPolicy)) {
      return res.status(400).json({ success: false, message: '잘못된 가입 정책이에요.' });
    }

    // School clubs — the creator must be verified at that school, and only that school name is accepted
    let groupUniversity = '';
    if (schoolOnly) {
      const me = await User.findById(req.user.id).select('verified university').lean();
      if (!me?.verified || !me?.university) {
        return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
      }
      groupUniversity = me.university;
    }

    // Prevent duplicate names (across active and pending_review)
    // School clubs are unique within their school; general groups are unique among general groups
    // (general groups and school clubs are different categories, so the same name is allowed across them)
    const dup = await Group.findOne({
      name: String(name).trim(),
      university: groupUniversity,
      status: { $in: ['active', 'pending_review'] },
    });
    if (dup) return res.status(409).json({ success: false, message: '이미 같은 이름의 모임이 있어요.' });

    const group = await Group.create({
      name: String(name).trim(),
      description: String(description || '').slice(0, 500),
      coverImage: String(coverImage || '').slice(0, 500),
      category,
      city: String(city || '').slice(0, 100),
      university: groupUniversity,
      ownerId: req.user.id,
      joinPolicy: joinPolicy || 'open',
      status: 'pending_review',
      memberCount: 1,
    });

    // The owner's own membership is automatic (active even while the group is pending_review)
    await GroupMembership.create({
      groupId: group._id,
      userId: req.user.id,
      role: 'owner',
      status: 'active',
    });

    res.status(201).json({ success: true, data: { id: group._id, status: group.status } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: '이미 존재하는 모임 이름이에요.' });
    }
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── GET /api/groups/:id — group detail ─────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    }
    const group = await Group.findById(req.params.id)
      .populate('ownerId', 'nickname avatarUrl')
      .lean();
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    if (group.status === 'rejected' && String(group.ownerId._id) !== String(req.user?.id)) {
      return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    }

    // My membership details
    let myMembership = null;
    if (req.user) {
      const m = await GroupMembership.findOne({ groupId: group._id, userId: req.user.id }).lean();
      if (m) {
        myMembership = { role: m.role, status: m.status, notifyPosts: m.notifyPosts, notifyChat: m.notifyChat };
      }
    }

    // Whether the community card is editable — owner and co-owners only
    const canEditCommunity = !!(myMembership &&
      (myMembership.role === 'owner' || myMembership.role === 'manager') &&
      myMembership.status === 'active');

    res.json({
      success: true,
      data: {
        id: group._id,
        name: group.name,
        description: group.description,
        coverImage: group.coverImage,
        category: group.category,
        city: group.city,
        university: group.university || '',
        owner: { id: group.ownerId._id, nickname: group.ownerId.nickname, avatarUrl: group.ownerId.avatarUrl },
        memberCount: group.memberCount,
        postCount: group.postCount,
        joinPolicy: group.joinPolicy,
        maxMembers: group.maxMembers,
        status: group.status,
        rejectReason: group.rejectReason || undefined,
        createdAt: group.createdAt,
        myMembership,
        community: group.community || { instagram: '', kakaoOpen: '', discord: '', homepage: '', notice: '' },
        canEditCommunity,
      },
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id — edit the group (owner) ───────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 수정할 수 있어요.' });

    const { name, description, coverImage, category, city, joinPolicy } = req.body || {};
    let coverChanged = false;
    let nameChanged = false;

    // Rename — school clubs are unique within their school, general groups among general groups
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.length < 2) {
        return res.status(400).json({ success: false, message: '이름은 2자 이상이어야 해요.' });
      }
      if (trimmed !== group.name) {
        const dup = await Group.findOne({
          _id: { $ne: group._id }, // Exclude this group itself
          name: trimmed,
          university: group.university || '',
          status: { $in: ['active', 'pending_review'] },
        });
        if (dup) return res.status(409).json({ success: false, message: '이미 같은 이름의 모임이 있어요.' });
        group.name = trimmed;
        nameChanged = true;
      }
    }

    if (description !== undefined) group.description = String(description).slice(0, 500);
    if (coverImage !== undefined) {
      group.coverImage = String(coverImage).slice(0, 500);
      coverChanged = true;
    }
    if (category !== undefined && VALID_CATEGORIES.includes(category)) group.category = category;
    if (city !== undefined) group.city = String(city).slice(0, 100);
    if (joinPolicy !== undefined && ['open', 'approval'].includes(joinPolicy)) group.joinPolicy = joinPolicy;
    await group.save();

    // Sync the cached name/cover on the group chat room
    if (nameChanged || coverChanged) {
      const update = {};
      if (nameChanged) update.groupName = group.name;
      if (coverChanged) update.groupCoverImage = group.coverImage;
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        update
      ).catch(() => {});
    }

    res.json({ success: true, data: { message: '수정되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id/community — edit the community card (owner/manager) ──
const COMMUNITY_FIELDS = ['instagram', 'kakaoOpen', 'discord', 'homepage', 'notice'];

function normalizeCommunityField(field, raw) {
  const s = String(raw || '').trim();
  if (!s || field === 'notice') return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (field === 'instagram') {
    const handle = s.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\.instagram\.com\//i, '');
    if (!handle.includes('/') && !handle.includes('.')) {
      return `https://instagram.com/${handle}`;
    }
    return `https://${handle.replace(/^https?:\/\//, '')}`;
  }
  return `https://${s.replace(/^\/+/, '')}`;
}

router.put('/:id/community', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!canManage(my)) {
      return res.status(403).json({ success: false, message: '그룹장 또는 부그룹장만 편집할 수 있어요.' });
    }
    const patch = {};
    for (const f of COMMUNITY_FIELDS) {
      if (req.body?.[f] !== undefined) {
        const normalized = normalizeCommunityField(f, req.body[f]);
        patch[`community.${f}`] = normalized.slice(0, f === 'notice' ? 500 : 300);
      }
    }
    await Group.findByIdAndUpdate(group._id, { $set: patch });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── DELETE /api/groups/:id — close the group (owner) ───
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 폐쇄할 수 있어요.' });

    // Delete the group chat room, including messages and notifications
    const chatRoom = await ChatRoom.findOne({ groupId: group._id, kind: 'group' });
    if (chatRoom) {
      await Promise.all([
        Message.deleteMany({ roomId: chatRoom._id }),
        Notification.deleteMany({ roomId: chatRoom._id }),
        chatRoom.deleteOne(),
      ]);
    }
    // Cascade: delete posts and memberships, then soft-close with group status='closed'
    await Promise.all([
      Post.deleteMany({ groupId: group._id }),
      GroupMembership.deleteMany({ groupId: group._id }),
    ]);
    group.status = 'closed';
    group.closedAt = new Date();
    await group.save();

    res.json({ success: true, data: { message: '모임이 폐쇄되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── POST /api/groups/:id/join ──────────────────────────
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || group.status !== 'active') {
      return res.status(404).json({ success: false, message: '가입할 수 있는 모임이 아니에요.' });
    }
    // School clubs: only verified members of the same school may join
    if (group.university) {
      const me = await User.findById(req.user.id).select('verified university').lean();
      if (!me?.verified || me.university !== group.university) {
        return res.status(403).json({
          success: false,
          message: `${group.university} 학교 인증 회원만 가입할 수 있어요.`,
        });
      }
    }
    const existing = await GroupMembership.findOne({ groupId: group._id, userId: req.user.id });
    if (existing && existing.status === 'banned') {
      return res.status(403).json({ success: false, message: '이 모임에서 차단된 상태에요.' });
    }
    if (existing && existing.status === 'active') {
      return res.json({ success: true, data: { status: 'active', message: '이미 가입되어 있어요.' } });
    }
    if (existing && existing.status === 'pending') {
      return res.json({ success: true, data: { status: 'pending', message: '승인 대기 중이에요.' } });
    }
    if (group.memberCount >= group.maxMembers) {
      return res.status(409).json({ success: false, message: '모임 인원이 가득 찼어요.' });
    }

    const status = group.joinPolicy === 'approval' ? 'pending' : 'active';
    await GroupMembership.create({ groupId: group._id, userId: req.user.id, role: 'member', status });
    if (status === 'active') {
      await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
      // Add the participant to the group chat room
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { $addToSet: { participants: req.user.id } }
      ).catch(() => {});
    } else {
      // Notify the owner that an approval is waiting
      try {
        await Notification.create({
          userId: group.ownerId,
          type: 'group_join_request',
          message: `'${group.name}' 모임 가입 요청이 있어요.`,
        });
      } catch {}
    }
    res.status(201).json({ success: true, data: { status } });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ success: true, data: { message: '이미 가입되어 있어요.' } });
    }
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── DELETE /api/groups/:id/leave ───────────────────────
router.delete('/:id/leave', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await GroupMembership.findOne({ groupId: group._id, userId: req.user.id });
    if (!my) return res.status(404).json({ success: false, message: '가입한 모임이 아니에요.' });
    if (my.role === 'owner') {
      return res.status(400).json({ success: false, message: '그룹장은 모임을 탈퇴할 수 없어요. 다른 멤버에게 그룹장을 양도하거나 모임을 폐쇄해주세요.' });
    }
    await my.deleteOne();
    if (my.status === 'active') {
      await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: -1 } });
      // Remove them from the group chat room too
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { $pull: { participants: req.user.id } }
      ).catch(() => {});
    }
    res.json({ success: true, data: { message: '모임에서 나갔어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── GET /api/groups/:id/members — member list ──────────
// ?status=active (default) | pending  (only an admin or the owner may list pending)
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const status = req.query.status === 'pending' ? 'pending' : 'active';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    if (status === 'pending') {
      const my = await getMyMembership(req.params.id, req.user.id);
      if (!canManage(my)) {
        return res.status(403).json({ success: false, message: '권한이 없어요.' });
      }
    }

    const members = await GroupMembership.find({ groupId: req.params.id, status })
      .sort({ role: 1, joinedAt: 1 }) // owner > manager > member
      .limit(limit)
      .populate('userId', 'nickname avatarUrl verified university')
      .lean();
    const formatted = members
      .filter(m => m.userId) // Exclude deleted accounts
      .map(m => ({
        id: m.userId._id,
        nickname: m.userId.nickname,
        avatarUrl: m.userId.avatarUrl,
        verified: m.userId.verified,
        university: m.userId.university,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id/members/:userId/approve — approve a join (owner/manager) ──
router.put('/:id/members/:userId/approve', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!canManage(my)) return res.status(403).json({ success: false, message: '권한이 없어요.' });
    if (group.memberCount >= group.maxMembers) {
      return res.status(409).json({ success: false, message: '모임 인원이 가득 찼어요.' });
    }

    const target = await GroupMembership.findOne({
      groupId: group._id, userId: req.params.userId, status: 'pending',
    });
    if (!target) return res.status(404).json({ success: false, message: '승인 대기 중인 멤버가 아니에요.' });

    target.status = 'active';
    await target.save();
    await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
    // Add them to the group chat room as well
    ChatRoom.findOneAndUpdate(
      { groupId: group._id, kind: 'group' },
      { $addToSet: { participants: req.params.userId } }
    ).catch(() => {});

    try {
      await Notification.create({
        userId: req.params.userId,
        type: 'group_approved',
        message: `'${group.name}' 모임 가입이 승인되었어요.`,
      });
    } catch {}
    res.json({ success: true, data: { message: '승인되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── DELETE /api/groups/:id/members/:userId/reject — reject a join (owner/manager) ──
router.delete('/:id/members/:userId/reject', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!canManage(my)) return res.status(403).json({ success: false, message: '권한이 없어요.' });

    const target = await GroupMembership.findOne({
      groupId: group._id, userId: req.params.userId, status: 'pending',
    });
    if (!target) return res.status(404).json({ success: false, message: '승인 대기 중인 멤버가 아니에요.' });

    await target.deleteOne();
    try {
      await Notification.create({
        userId: req.params.userId,
        type: 'group_rejected',
        message: `'${group.name}' 모임 가입 신청이 거절되었어요.`,
      });
    } catch {}
    res.json({ success: true, data: { message: '거절되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── POST /api/groups/:id/cover — upload a cover image (owner) ──
router.post('/:id/cover', requireAuth, uploadCover.single('image'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 가능해요.' });
    if (!req.file?.path) return res.status(400).json({ success: false, message: '이미지를 업로드하지 못했어요.' });

    group.coverImage = req.file.path;
    await group.save();
    // Update the group chat room's cache too
    ChatRoom.findOneAndUpdate(
      { groupId: group._id, kind: 'group' },
      { groupCoverImage: req.file.path }
    ).catch(() => {});

    res.json({ success: true, data: { coverImage: req.file.path } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── DELETE /api/groups/:id/members/:userId — remove a member (owner/manager) ──
router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!canManage(my)) return res.status(403).json({ success: false, message: '권한이 없어요.' });

    if (String(req.params.userId) === String(group.ownerId)) {
      return res.status(400).json({ success: false, message: '그룹장은 추방할 수 없어요.' });
    }

    const target = await GroupMembership.findOne({ groupId: group._id, userId: req.params.userId });
    if (!target) return res.status(404).json({ success: false, message: '해당 멤버를 찾을 수 없어요.' });

    const wasActive = target.status === 'active';
    // Ban option (req.query.ban=true also blocks them)
    if (req.query.ban === 'true') {
      target.status = 'banned';
      target.bannedReason = String(req.body?.reason || '').slice(0, 500);
      await target.save();
    } else {
      await target.deleteOne();
    }
    if (wasActive) {
      await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: -1 } });
      // Remove them from the group chat room too
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { $pull: { participants: req.params.userId } }
      ).catch(() => {});
    }

    // Notify the removed member
    try {
      await Notification.create({
        userId: req.params.userId,
        type: req.query.ban === 'true' ? 'group_banned' : 'group_kicked',
        message: `'${group.name}' 모임에서 ${req.query.ban === 'true' ? '차단' : '추방'}되었어요.`,
      });
    } catch {}

    res.json({ success: true, data: { message: '처리되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id/members/:userId/role — promote/demote a co-owner (owner) ──
router.put('/:id/members/:userId/role', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 가능해요.' });

    const { role } = req.body || {};
    if (!['manager', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'role은 manager 또는 member만 가능해요.' });
    }

    const target = await GroupMembership.findOne({ groupId: group._id, userId: req.params.userId, status: 'active' });
    if (!target) return res.status(404).json({ success: false, message: '해당 멤버를 찾을 수 없어요.' });
    if (target.role === 'owner') return res.status(400).json({ success: false, message: '그룹장은 변경할 수 없어요.' });

    target.role = role;
    await target.save();
    res.json({ success: true, data: { role } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── POST /api/groups/:id/transfer — hand over ownership (owner) ──
router.post('/:id/transfer', requireAuth, async (req, res) => {
  try {
    const { newOwnerId } = req.body || {};
    if (!newOwnerId) return res.status(400).json({ success: false, message: '새 그룹장 ID가 필요해요.' });

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    if (String(group.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '그룹장만 가능해요.' });
    }

    const target = await GroupMembership.findOne({ groupId: group._id, userId: newOwnerId, status: 'active' });
    if (!target) return res.status(404).json({ success: false, message: '대상이 모임 멤버가 아니에요.' });

    // Move the owner role
    await GroupMembership.findOneAndUpdate(
      { groupId: group._id, userId: req.user.id },
      { role: 'member' }
    );
    target.role = 'owner';
    await target.save();
    group.ownerId = newOwnerId;
    await group.save();

    res.json({ success: true, data: { message: '그룹장이 양도되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── GET /api/groups/:id/chat — group chat room info (members only) ──
router.get('/:id/chat', requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    }
    const membership = await GroupMembership.findOne({
      groupId, userId: req.user.id, status: 'active',
    }).lean();
    if (!membership) {
      return res.status(403).json({ success: false, message: '모임 멤버만 입장할 수 있어요.' });
    }

    let room = await ChatRoom.findOne({ groupId, kind: 'group' });
    // Lazily create the room for older groups (approved before Phase 2A) that have none
    if (!room) {
      const group = await Group.findById(groupId).lean();
      if (!group || group.status !== 'active') {
        return res.status(404).json({ success: false, message: '활성 모임이 아니에요.' });
      }
      const activeMembers = await GroupMembership.find({
        groupId, status: 'active',
      }).distinct('userId');
      room = await ChatRoom.create({
        kind: 'group',
        groupId,
        groupName: group.name,
        groupCoverImage: group.coverImage || '',
        participants: activeMembers,
        status: 'accepted',
      });
    }

    res.json({
      success: true,
      data: {
        id: room._id,
        groupId,
        groupName: room.groupName,
        groupCoverImage: room.groupCoverImage,
        participantCount: room.participants.length,
      },
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── GET /api/groups/:id/posts — group board posts (members only) ──
router.get('/:id/posts', requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    }
    const membership = await GroupMembership.findOne({
      groupId, userId: req.user.id, status: 'active',
    }).lean();
    if (!membership) {
      return res.status(403).json({ success: false, message: '모임 멤버만 볼 수 있어요.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const filter = { groupId, hidden: { $ne: true }, autoHidden: { $ne: true } };
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'nickname avatarUrl')
        .lean(),
      Post.countDocuments(filter),
    ]);

    const formatted = posts.map(p => ({
      id: p._id,
      title: p.title,
      content: (p.content || '').replace(/<[^>]+>/g, '').slice(0, 200),
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      viewCount: p.viewCount || 0,
      createdAt: p.createdAt,
      pinned: p.pinned,
      thumbnail: p.images?.[0] || null,
      nickname: p.userId?.nickname || '탈퇴한 회원',
      avatarUrl: p.userId?.avatarUrl || null,
      userId: p.userId?._id,
    }));

    res.json({ success: true, data: { posts: formatted, total } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id/notifications — my notification settings ──
router.put('/:id/notifications', requireAuth, async (req, res) => {
  try {
    const my = await GroupMembership.findOne({ groupId: req.params.id, userId: req.user.id, status: 'active' });
    if (!my) return res.status(404).json({ success: false, message: '가입한 모임이 아니에요.' });

    const { notifyPosts, notifyChat } = req.body || {};
    if (typeof notifyPosts === 'boolean') my.notifyPosts = notifyPosts;
    if (typeof notifyChat === 'boolean') my.notifyChat = notifyChat;
    await my.save();
    res.json({ success: true, data: { notifyPosts: my.notifyPosts, notifyChat: my.notifyChat } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
