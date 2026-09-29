// Endpoints for the school community
// - GET /api/universities/chat — my school's all-hands chat room (lazy-created, auto-joined)
// - GET /api/universities/members/count — verified member count at my school
// - GET /api/universities/members — search verified members at my school (for handing over the presidency)
// - GET /api/universities/community — my school's community card (social links + a notice)
// - PUT /api/universities/community — editable only by the student president or an admin
// - PUT /api/universities/leader/transfer — the sitting president hands over to another verified member
// - DELETE /api/universities/leader — the sitting president steps down
const express = require('express');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const University = require('../models/University');
const Notification = require('../models/Notification');
const { sendPush } = require('../utils/push');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COMMUNITY_FIELDS = ['instagram', 'kakaoOpen', 'discord', 'homepage', 'notice'];

function emptyCommunity() {
  return { instagram: '', kakaoOpen: '', discord: '', homepage: '', notice: '' };
}

// Normalize on save, so a handle or short URL the president typed still opens the external app on tap
// - instagram: "@uoft.korean" / "uoft.korean" → "https://instagram.com/uoft.korean"
// - kakaoOpen / discord / homepage: prefix "https://" when no scheme is present
// - notice: plain text (no URL conversion)
function normalizeCommunityField(field, raw) {
  const s = String(raw || '').trim();
  if (!s || field === 'notice') return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (field === 'instagram') {
    const handle = s.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\.instagram\.com\//i, '');
    // A handle with no slash becomes instagram.com/{handle}
    if (!handle.includes('/') && !handle.includes('.')) {
      return `https://instagram.com/${handle}`;
    }
    return `https://${handle.replace(/^https?:\/\//, '')}`;
  }
  // Everything else just gets the https:// prefix
  return `https://${s.replace(/^\/+/, '')}`;
}

// GET /api/universities/members/count — verified member count at my school
router.get('/members/count', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const count = await User.countDocuments({ verified: true, university: me.university });
    res.json({ success: true, data: { count, university: me.university } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/universities/chat — school-wide chat room info (verified members only)
// On first entry, create the room and add the caller
router.get('/chat', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const university = me.university;

    let room = await ChatRoom.findOne({ kind: 'school', university });
    if (!room) {
      // First entry — create the room
      room = await ChatRoom.create({
        kind: 'school',
        university,
        groupName: university,        // Cached for the header
        participants: [req.user.id],
        status: 'accepted',
      });
    } else if (!room.participants.some(p => String(p) === String(req.user.id))) {
      // First time in an existing room — add the participant
      room.participants.push(req.user.id);
      await room.save();
    }

    res.json({
      success: true,
      data: {
        id: room._id,
        university: room.university,
        groupName: room.groupName,
        participantCount: room.participants.length,
      },
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/universities/community — my school's community card
// canEdit is true for an admin, or for the student president of that school
// Lazy validation of the president: vacate the seat if they are no longer verified, moved schools, or deleted their account
router.get('/community', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university role').lean();
    if (!me) return res.status(401).json({ success: false });
    if (!me.verified || !me.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const uni = await University.findOne({ name: me.university });
    if (uni && uni.leaderUserId) {
      const leader = await User.findById(uni.leaderUserId).select('verified university').lean();
      const stillValid = leader && leader.verified && leader.university === uni.name;
      if (!stillValid) {
        uni.leaderUserId = null;
        await uni.save();
      }
    }
    const community = (uni && uni.community) || emptyCommunity();
    const isLeader = !!(uni && uni.leaderUserId && String(uni.leaderUserId) === String(req.user.id));
    const canEdit = me.role === 'admin' || isLeader;
    res.json({
      success: true,
      data: {
        university: me.university,
        community,
        isLeader,
        canEdit,
        hasLeader: !!(uni && uni.leaderUserId),
      },
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/universities/community — student president or admin only
router.put('/community', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university role').lean();
    if (!me) return res.status(401).json({ success: false });
    if (!me.verified || !me.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const uni = await University.findOne({ name: me.university });
    if (!uni) return res.status(404).json({ success: false, message: '학교를 찾을 수 없어요.' });

    const isLeader = uni.leaderUserId && String(uni.leaderUserId) === String(req.user.id);
    if (me.role !== 'admin' && !isLeader) {
      return res.status(403).json({ success: false, message: '학생회장만 편집할 수 있어요.' });
    }

    const patch = {};
    for (const f of COMMUNITY_FIELDS) {
      if (req.body?.[f] !== undefined) {
        const normalized = normalizeCommunityField(f, req.body[f]);
        patch[`community.${f}`] = normalized.slice(0, f === 'notice' ? 500 : 300);
      }
    }
    await University.findByIdAndUpdate(uni._id, { $set: patch });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/universities/members?search=&limit=50&includeSelf=true|false
// Verified members at the same school. includeSelf=false (the default, for the picker) excludes the caller,
// true includes them (for the community member list screen)
router.get('/members', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const includeSelf = String(req.query.includeSelf || 'false') === 'true';
    const filter = {
      verified: true,
      university: me.university,
    };
    if (!includeSelf) filter._id = { $ne: req.user.id };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.nickname = { $regex: escaped, $options: 'i' };
    }
    const list = await User.find(filter)
      .select('nickname avatarUrl role')
      .sort({ nickname: 1 })
      .limit(limit)
      .lean();
    // Send the president's ID too, so the client can show the ⭐ badge
    const uni = await University.findOne({ name: me.university }).select('leaderUserId').lean();
    res.json({
      success: true,
      data: list.map(u => ({ id: u._id, nickname: u.nickname, avatarUrl: u.avatarUrl, role: u.role })),
      leaderUserId: uni?.leaderUserId || null,
      university: me.university,
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/universities/leader/transfer { newUserId } — the sitting president hands over to the next one
router.put('/leader/transfer', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const uni = await University.findOne({ name: me.university });
    if (!uni) return res.status(404).json({ success: false, message: '학교를 찾을 수 없어요.' });
    if (!uni.leaderUserId || String(uni.leaderUserId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '현재 학생회장만 인수인계할 수 있어요.' });
    }
    const newUserId = req.body?.newUserId;
    if (!newUserId) return res.status(400).json({ success: false, message: '다음 회장을 선택해 주세요.' });
    if (String(newUserId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '본인에게 넘길 수 없어요.' });
    }
    const next = await User.findById(newUserId).select('verified university nickname').lean();
    if (!next) return res.status(404).json({ success: false, message: '대상 회원을 찾을 수 없어요.' });
    if (!next.verified || next.university !== me.university) {
      return res.status(400).json({ success: false, message: '같은 학교 인증 회원에게만 넘길 수 있어요.' });
    }
    uni.leaderUserId = next._id;
    await uni.save();

    // Notify and push to the new president
    try {
      await Notification.create({
        userId: next._id,
        type: 'university_leader',
        message: `${me.university}의 학생회장으로 인수인계받았어요. 학교 커뮤니티를 이어서 꾸며보세요!`,
      });
      const withPush = await User.findById(next._id).select('pushToken').lean();
      if (withPush?.pushToken) {
        await sendPush(
          withPush.pushToken,
          '학생회장 인수인계',
          `${me.university}의 학생회장이 되었어요`,
          { kind: 'university_leader', university: me.university },
          next._id
        );
      }
    } catch (e) {
      console.error('[leader transfer notify]', e.message);
    }

    res.json({ success: true, data: { newLeaderId: next._id, nickname: next.nickname } });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/universities/leader — the sitting president steps down (the seat is left vacant)
router.delete('/leader', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const uni = await University.findOne({ name: me.university });
    if (!uni) return res.status(404).json({ success: false, message: '학교를 찾을 수 없어요.' });
    if (!uni.leaderUserId || String(uni.leaderUserId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '현재 학생회장만 사임할 수 있어요.' });
    }
    uni.leaderUserId = null;
    await uni.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
