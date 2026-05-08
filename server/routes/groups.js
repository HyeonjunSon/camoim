// 모임 (Group) — 사용자 생성, admin 승인 후 활성화
// 모임 = 게시판 + (Phase 2) 그룹 채팅 + 멤버십
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

// Cloudinary 모임 커버 업로드
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
    transformation: [{ width: 1200, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  },
});
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const VALID_CATEGORIES = ['hobby', 'study', 'local', 'job', 'workinghol', 'general'];

// 멤버 권한 확인
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

// ── GET /api/groups — 모임 목록 (검색/필터) ─────────────
// ?box=all (기본) | mine (가입한 모임만)
// ?category=hobby&city=Toronto&q=keyword&sort=popular|recent
// ?university=토론토 대학교 — 학교 한정 동아리만
// ?excludeUniversity=true — 일반 모임 (학교 한정 제외)
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
    // 'mine'이 아닌 'all' 기본 모드에서 university/excludeUniversity 미지정 시
    // 사용자가 보고 가입할 수 있는 모임 + 이미 가입한 모임 노출:
    //  - admin: 전부
    //  - 인증 회원: 일반 모임 + 본인 학교 동아리 + 본인이 이미 가입한 그룹 (학교 무관)
    //  - 그 외 (미인증/비로그인): 일반 모임 + 본인이 가입한 그룹
    // (이미 가입한 그룹은 학교 무관하게 항상 보여야 함 — 안 그러면 '내 모임' ⊄ '전체'가 되어버림)
    if (!university && excludeUniversity !== 'true' && box !== 'mine') {
      let me = null;
      if (req.user) {
        me = await User.findById(req.user.id).select('verified university role').lean();
      }
      if (me?.role === 'admin') {
        // 필터 안 거는 — 전부
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

// ── POST /api/groups — 모임 신청 (pending_review) ─────────
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

    // 학교 한정 동아리 — 본인 학교 인증돼있어야 만들 수 있고, 그 학교명만 허용
    let groupUniversity = '';
    if (schoolOnly) {
      const me = await User.findById(req.user.id).select('verified university').lean();
      if (!me?.verified || !me?.university) {
        return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
      }
      groupUniversity = me.university;
    }

    // 같은 이름 중복 방지 (active 또는 pending_review)
    const dup = await Group.findOne({
      name: String(name).trim(),
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

    // 그룹장 본인 자동 멤버십 (pending_review 동안에도 본인은 active)
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

// ── GET /api/groups/:id — 모임 상세 ──────────────────────
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

    // 내 멤버십 정보
    let myMembership = null;
    if (req.user) {
      const m = await GroupMembership.findOne({ groupId: group._id, userId: req.user.id }).lean();
      if (m) {
        myMembership = { role: m.role, status: m.status, notifyPosts: m.notifyPosts, notifyChat: m.notifyChat };
      }
    }

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
      },
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── PUT /api/groups/:id — 모임 정보 수정 (owner) ──────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 수정할 수 있어요.' });

    const { description, coverImage, category, city, joinPolicy } = req.body || {};
    let coverChanged = false;
    if (description !== undefined) group.description = String(description).slice(0, 500);
    if (coverImage !== undefined) {
      group.coverImage = String(coverImage).slice(0, 500);
      coverChanged = true;
    }
    if (category !== undefined && VALID_CATEGORIES.includes(category)) group.category = category;
    if (city !== undefined) group.city = String(city).slice(0, 100);
    if (joinPolicy !== undefined && ['open', 'approval'].includes(joinPolicy)) group.joinPolicy = joinPolicy;
    // 이름 변경은 같은 이름 중복 방지를 위해 별도 검토 — 일단 비허용
    await group.save();
    // 그룹 채팅방의 캐시된 커버 이미지도 동기화
    if (coverChanged) {
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { groupCoverImage: group.coverImage }
      ).catch(() => {});
    }

    res.json({ success: true, data: { message: '수정되었어요.' } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ── DELETE /api/groups/:id — 모임 폐쇄 (owner) ────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 폐쇄할 수 있어요.' });

    // 그룹 채팅방 삭제 (메시지·알림까지)
    const chatRoom = await ChatRoom.findOne({ groupId: group._id, kind: 'group' });
    if (chatRoom) {
      await Promise.all([
        Message.deleteMany({ roomId: chatRoom._id }),
        Notification.deleteMany({ roomId: chatRoom._id }),
        chatRoom.deleteOne(),
      ]);
    }
    // cascade: 글 삭제 + 멤버십 삭제 + 그룹 status='closed' (소프트)
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

// ── POST /api/groups/:id/join — 가입 ─────────────────────
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || group.status !== 'active') {
      return res.status(404).json({ success: false, message: '가입할 수 있는 모임이 아니에요.' });
    }
    // 학교 한정 동아리: 인증된 같은 학교 회원만 가입 가능
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
      // 그룹 채팅방에 참여자 추가
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { $addToSet: { participants: req.user.id } }
      ).catch(() => {});
    } else {
      // 승인 대기 알림 → 그룹장에게
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

// ── DELETE /api/groups/:id/leave — 탈퇴 ──────────────────
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
      // 그룹 채팅방에서도 제거
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

// ── GET /api/groups/:id/members — 멤버 목록 ──────────────
// ?status=active (기본) | pending  (관리자/owner만 pending 조회 가능)
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
      .filter(m => m.userId) // 탈퇴한 사용자 제외
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

// ── PUT /api/groups/:id/members/:userId/approve — 가입 승인 (owner/manager) ──
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
    // 그룹 채팅방에도 추가
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

// ── DELETE /api/groups/:id/members/:userId/reject — 가입 거절 (owner/manager) ──
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

// ── POST /api/groups/:id/cover — 커버 이미지 업로드 (owner) ──
router.post('/:id/cover', requireAuth, uploadCover.single('image'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: '모임을 찾을 수 없어요.' });
    const my = await getMyMembership(group._id, req.user.id);
    if (!isOwner(my)) return res.status(403).json({ success: false, message: '그룹장만 가능해요.' });
    if (!req.file?.path) return res.status(400).json({ success: false, message: '이미지를 업로드하지 못했어요.' });

    group.coverImage = req.file.path;
    await group.save();
    // 그룹 채팅방 캐시도 업데이트
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

// ── DELETE /api/groups/:id/members/:userId — 추방 (owner/manager) ──
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
    // ban 옵션 (req.query.ban=true면 차단)
    if (req.query.ban === 'true') {
      target.status = 'banned';
      target.bannedReason = String(req.body?.reason || '').slice(0, 500);
      await target.save();
    } else {
      await target.deleteOne();
    }
    if (wasActive) {
      await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: -1 } });
      // 그룹 채팅방에서도 제거
      ChatRoom.findOneAndUpdate(
        { groupId: group._id, kind: 'group' },
        { $pull: { participants: req.params.userId } }
      ).catch(() => {});
    }

    // 추방당한 사람에게 알림
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

// ── PUT /api/groups/:id/members/:userId/role — 부그룹장 임명/해임 (owner) ──
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

// ── POST /api/groups/:id/transfer — 그룹장 양도 (owner) ──
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

    // owner role 이동
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

// ── GET /api/groups/:id/chat — 모임 채팅방 정보 (멤버 전용) ──
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
    // 옛 모임 (Phase 2A 이전 승인됨)인데 채팅방이 없으면 lazy create
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

// ── GET /api/groups/:id/posts — 모임 게시판 글 목록 (멤버 전용) ──
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

// ── PUT /api/groups/:id/notifications — 내 알림 설정 ───
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
