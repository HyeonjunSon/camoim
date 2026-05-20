// 학교 커뮤니티 전용 엔드포인트
// - GET /api/universities/chat — 본인 학교 전체 채팅방 (lazy-create + 자동 입장)
// - GET /api/universities/members/count — 본인 학교 인증 회원 수
// - GET /api/universities/community — 본인 학교 커뮤니티 카드 (소셜 링크 + 공지)
// - PUT /api/universities/community — 학생회장 또는 admin만 편집 가능
const express = require('express');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const University = require('../models/University');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COMMUNITY_FIELDS = ['instagram', 'kakaoOpen', 'discord', 'homepage', 'notice'];

function emptyCommunity() {
  return { instagram: '', kakaoOpen: '', discord: '', homepage: '', notice: '' };
}

// GET /api/universities/members/count — 본인 학교 인증 회원 수
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

// GET /api/universities/chat — 학교 전체 채팅방 정보 (인증 회원 전용)
// 첫 진입 시 채팅방 생성 + 본인 자동 추가
router.get('/chat', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university').lean();
    if (!me?.verified || !me?.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const university = me.university;

    let room = await ChatRoom.findOne({ kind: 'school', university });
    if (!room) {
      // 첫 진입 — 방 생성
      room = await ChatRoom.create({
        kind: 'school',
        university,
        groupName: university,        // 헤더 표시용 캐시
        participants: [req.user.id],
        status: 'accepted',
      });
    } else if (!room.participants.some(p => String(p) === String(req.user.id))) {
      // 기존 방에 처음 들어옴 — 참여자 추가
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

// GET /api/universities/community — 본인 학교 커뮤니티 카드
// canEdit = admin 또는 본인이 해당 학교 학생회장일 때 true
router.get('/community', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('verified university role').lean();
    if (!me) return res.status(401).json({ success: false });
    if (!me.verified || !me.university) {
      return res.status(403).json({ success: false, message: '학교 인증이 필요해요.' });
    }
    const uni = await University.findOne({ name: me.university }).lean();
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

// PUT /api/universities/community — 학생회장 또는 admin만
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
        patch[`community.${f}`] = String(req.body[f]).trim().slice(0, f === 'notice' ? 500 : 300);
      }
    }
    await University.findByIdAndUpdate(uni._id, { $set: patch });
    res.json({ success: true });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
