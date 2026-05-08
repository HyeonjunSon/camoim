const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { isChatBlocked, getBlockedUserIds } = require('../utils/blocks');

// GET /api/chats — 내 채팅방 목록 (DM + 그룹 채팅 통합)
// ?box=accepted (기본) | requests (내가 받은 요청만) | sent (내가 보낸 대기중)
router.get('/', requireAuth, async (req, res) => {
  try {
    const box = req.query.box || 'accepted';
    const me = req.user.id;
    let filter = { participants: me };
    if (box === 'accepted') filter.status = 'accepted';
    else if (box === 'requests') filter = { participants: me, status: 'pending', requesterId: { $ne: me }, kind: 'dm' };
    else if (box === 'sent') filter = { participants: me, status: 'pending', requesterId: me, kind: 'dm' };

    const rooms = await ChatRoom.find(filter)
      .populate('participants', 'nickname avatarUrl')
      .sort({ lastMessageAt: -1 });

    // chat 차단된 상대와의 방은 숨김 (DM만)
    const chatBlocked = new Set(await getBlockedUserIds(me, 'blockChat'));

    const result = rooms
      .filter(room => {
        if (room.kind === 'group' || room.kind === 'school') return true;
        const other = room.participants.find(p => p && String(p._id) !== String(me));
        if (!other) return true;
        return !chatBlocked.has(String(other._id));
      })
      .map(room => {
        // 그룹 채팅 — 모임 정보 노출
        if (room.kind === 'group') {
          return {
            id: room._id,
            kind: 'group',
            group: {
              id: room.groupId,
              name: room.groupName,
              coverImage: room.groupCoverImage,
              memberCount: room.participants.length,
            },
            lastMessage: room.lastMessage,
            lastMessageAt: room.lastMessageAt,
            unreadCount: room.unreadCount?.get(String(me)) ?? 0,
            status: 'accepted',
          };
        }
        // 학교 전체 채팅
        if (room.kind === 'school') {
          return {
            id: room._id,
            kind: 'school',
            school: {
              university: room.university,
              name: room.groupName || room.university,
              memberCount: room.participants.length,
            },
            lastMessage: room.lastMessage,
            lastMessageAt: room.lastMessageAt,
            unreadCount: room.unreadCount?.get(String(me)) ?? 0,
            status: 'accepted',
          };
        }
        // DM — 기존 형식
        const other = room.participants.find(p => p && String(p._id) !== String(me));
        const hasNullParticipant = room.participants.some(p => p === null);
        const otherDeleted = !other && hasNullParticipant;
        const otherLeft = !other && !hasNullParticipant;

        return {
          id: room._id,
          kind: 'dm',
          other: other
            ? { id: other._id, nickname: other.nickname, avatarUrl: other.avatarUrl }
            : (room.otherSnapshot ?? null),
          lastMessage: room.lastMessage,
          lastMessageAt: room.lastMessageAt,
          unreadCount: room.unreadCount?.get(String(me)) ?? 0,
          status: room.status,
          requesterId: room.requesterId,
          isRequester: String(room.requesterId) === String(me),
          otherLeft,
          otherDeleted,
        };
      });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// POST /api/chats — 채팅방 생성 or 기존 방 반환
router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId 필요' });
    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '자기 자신과 채팅할 수 없어요.' });
    }

    const target = await User.findById(targetUserId).select('nickname avatarUrl');
    if (!target) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없어요.' });

    // 차단 체크 (양방향)
    if (await isChatBlocked(req.user.id, targetUserId)) {
      return res.status(403).json({ success: false, message: '차단된 사용자와는 채팅할 수 없어요.' });
    }

    // 1) 둘 다 active한 기존 방 찾기
    let room = await ChatRoom.findOne({
      participants: { $all: [req.user.id, targetUserId], $size: 2 },
    });

    // 2) 한 명이 나간 orphan room이 있으면 재활성화 (메시지는 클리어)
    //    - 같은 roomId 유지 → 데이터 정리 + DB 비대 방지
    //    - 옛 대화 내역은 삭제 (프라이버시 + 신선한 시작)
    if (!room) {
      const orphan = await ChatRoom.findOne({
        $or: [
          { participants: req.user.id, 'otherSnapshot.id': targetUserId },
          { participants: targetUserId, 'otherSnapshot.id': req.user.id },
        ],
      });
      if (orphan) {
        // 옛 메시지 + 알림 모두 삭제
        await Promise.all([
          Message.deleteMany({ roomId: orphan._id }),
          Notification.deleteMany({ roomId: orphan._id }),
        ]);
        // 빠진 참여자 다시 추가
        if (!orphan.participants.some(p => String(p) === String(req.user.id))) {
          orphan.participants.push(req.user.id);
        }
        if (!orphan.participants.some(p => String(p) === String(targetUserId))) {
          orphan.participants.push(targetUserId);
        }
        // 새 요청 사이클 시작 — pending, 내가 요청자
        orphan.status = 'pending';
        orphan.requesterId = req.user.id;
        orphan.otherSnapshot = undefined;
        orphan.lastMessage = '';
        orphan.lastMessageAt = new Date();
        orphan.unreadCount = new Map();
        await orphan.save();
        room = orphan;
      }
    }

    // 3) 그래도 없으면 새 방 생성
    if (!room) {
      room = await ChatRoom.create({
        participants: [req.user.id, targetUserId],
        status: 'pending',
        requesterId: req.user.id,
      });
    }

    res.json({
      success: true,
      data: {
        id: room._id,
        other: { id: target._id, nickname: target.nickname, avatarUrl: target.avatarUrl },
        status: room.status,
        isRequester: String(room.requesterId) === String(req.user.id),
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/chats/:roomId/messages — 메시지 목록 (페이지네이션)
router.get('/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없어요.' });
    if (!room.participants.some(p => String(p) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: '접근 권한이 없어요.' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // 이 메시지 이전 것들 로드 (무한스크롤)

    const query = { roomId: req.params.roomId };
    if (before) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'nickname');

    // 읽음 처리
    await Message.updateMany(
      { roomId: req.params.roomId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    // 내 unread 초기화
    await ChatRoom.findByIdAndUpdate(req.params.roomId, {
      $set: { [`unreadCount.${req.user.id}`]: 0 },
    });

    // senderId를 문자열 ID로 변환 (클라이언트에서 me.id와 비교 가능하도록)
    const formatted = messages.reverse().map(m => ({
      id: m._id,
      roomId: m.roomId,
      senderId: m.senderId?._id ?? m.senderId,
      senderNickname: m.senderId?.nickname ?? '알 수 없음',
      content: m.content,
      readBy: m.readBy,
      createdAt: m.createdAt,
    }));

    // 그룹 채팅은 otherLeft/otherDeleted 개념 없음
    let otherLeft = false;
    let otherDeleted = false;
    // DM에서만 상대 이탈/탈퇴 판정 (group/school은 N명이라 무의미)
    if (room.kind === 'dm') {
      if (room.participants.length < 2) {
        otherLeft = true;
      } else {
        const otherId = room.participants.find(p => String(p) !== String(req.user.id));
        if (otherId) {
          const otherUser = await User.findById(otherId).select('_id').lean();
          if (!otherUser) otherDeleted = true;
        }
      }
    }

    res.json({
      success: true,
      data: formatted,
      otherLeft,
      otherDeleted,
      kind: room.kind,
      group: room.kind === 'group' ? {
        id: room.groupId,
        name: room.groupName,
        coverImage: room.groupCoverImage,
        memberCount: room.participants.length,
      } : undefined,
      school: room.kind === 'school' ? {
        university: room.university,
        name: room.groupName || room.university,
        memberCount: room.participants.length,
      } : undefined,
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/chats/:roomId/accept — 채팅 요청 수락 (수신자만)
router.put('/:roomId/accept', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없어요.' });
    if (!room.participants.some(p => String(p) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    if (String(room.requesterId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '본인이 보낸 요청은 수락할 수 없어요.' });
    }
    if (room.status === 'accepted') {
      return res.json({ success: true, data: { message: '이미 수락된 채팅입니다.' } });
    }
    room.status = 'accepted';
    await room.save();
    res.json({ success: true, data: { id: room._id, status: room.status } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/chats/:roomId — 채팅방 나가기
// 내가 나가면 participants에서 제거, 둘 다 나가면 방+메시지 완전 삭제
router.delete('/:roomId', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없어요.' });
    if (!room.participants.some(p => String(p) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    // 그룹 채팅방은 모임에서 나가야 함
    if (room.kind === 'group') {
      return res.status(400).json({
        success: false,
        message: '그룹 채팅방은 모임에서 나가야 떠날 수 있어요.',
      });
    }
    // 학교 전체 채팅: 참여자에서 본인 제거 (방은 유지)
    if (room.kind === 'school') {
      room.participants = room.participants.filter(p => String(p) !== String(req.user.id));
      await room.save();
      return res.json({ success: true, data: { message: '나갔어요.' } });
    }

    // 나가기 전에 상대방 ID 확보
    const otherId = room.participants.find(p => String(p) !== String(req.user.id));

    // 나가는 사람의 정보를 스냅샷으로 저장 (상대방이 나중에 닉네임을 볼 수 있도록)
    const leaver = await User.findById(req.user.id).select('nickname avatarUrl');

    // participants에서 나를 제거
    room.participants = room.participants.filter(p => String(p) !== String(req.user.id));

    if (room.participants.length === 0) {
      // 둘 다 나갔으면 방+메시지 완전 삭제
      await Message.deleteMany({ roomId: room._id });
      await room.deleteOne();
    } else {
      // 상대방을 위해 나간 사람 정보 스냅샷 저장
      if (leaver) {
        room.otherSnapshot = {
          id: leaver._id,
          nickname: leaver.nickname,
          avatarUrl: leaver.avatarUrl,
        };
      }
      await room.save();
    }

    // 소켓으로 상대방에게 나감 알림
    // 1) 채팅방 소켓 룸 (상대가 채팅방 화면에 있을 때)
    // 2) user_{상대} 개인 룸 (상대가 어느 화면에 있든)
    const io = req.app.get('io');
    if (io) {
      const payload = {
        roomId: String(req.params.roomId),
        userId: String(req.user.id),
      };
      io.to(String(req.params.roomId)).emit('room_left', payload);
      if (otherId) {
        io.to(`user_${otherId}`).emit('room_left', payload);
      }
    }

    res.json({ success: true, data: { message: '삭제되었습니다.' } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// GET /api/chats/check/:userId — 특정 유저와의 채팅 상태 확인
router.get('/check/:userId', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findOne({
      participants: { $all: [req.user.id, req.params.userId], $size: 2 },
    });

    if (!room) {
      return res.json({ success: true, data: { status: 'none' } });
    }

    res.json({
      success: true,
      data: {
        status: room.status, // 'pending' | 'accepted'
        roomId: room._id,
        isRequester: String(room.requesterId) === String(req.user.id),
      },
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

module.exports = router;
