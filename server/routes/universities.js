// 학교 커뮤니티 전용 엔드포인트
// - GET /api/universities/chat — 본인 학교 전체 채팅방 (lazy-create + 자동 입장)
const express = require('express');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
