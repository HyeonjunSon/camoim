const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const University = require('../models/University');
const { isChatBlocked, getBlockedUserIds } = require('../utils/blocks');

// GET /api/chats — my chat rooms (DMs and group chats together)
// ?box=accepted (default) | requests (only ones sent to me) | sent (mine, still pending)
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

    // Hide rooms with anyone chat-blocked (DMs only)
    const chatBlocked = new Set(await getBlockedUserIds(me, 'blockChat'));

    const result = rooms
      .filter(room => {
        if (room.kind === 'group' || room.kind === 'school') return true;
        const other = room.participants.find(p => p && String(p._id) !== String(me));
        if (!other) return true;
        return !chatBlocked.has(String(other._id));
      })
      .map(room => {
        // Group chat — expose the group details
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
        // School-wide chat
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
        // DM — the original shape
        const other = room.participants.find(p => p && String(p._id) !== String(me));
        const hasNullParticipant = room.participants.some(p => p === null);
        const otherDeleted = !other && hasNullParticipant;
        const otherLeft = !other && !hasNullParticipant;
        // Intro-board chats never reveal the other side's real nickname/avatar, even after they
        // leave or delete their account — this room only ever existed anonymously.
        const anonymous = !!room.introPostId;

        return {
          id: room._id,
          kind: 'dm',
          other: anonymous
            ? { id: other?._id ?? null, nickname: '소개팅 상대', avatarUrl: '', anonymous: true }
            : (other
              ? { id: other._id, nickname: other.nickname, avatarUrl: other.avatarUrl }
              : (room.otherSnapshot ?? null)),
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

// POST /api/chats — create a room, or return the existing one
router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId 필요' });
    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: '자기 자신과 채팅할 수 없어요.' });
    }

    const target = await User.findById(targetUserId).select('nickname avatarUrl');
    if (!target) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없어요.' });

    // Block check (both directions)
    if (await isChatBlocked(req.user.id, targetUserId)) {
      return res.status(403).json({ success: false, message: '차단된 사용자와는 채팅할 수 없어요.' });
    }

    // 1) Look for an existing room where both sides are active
    let room = await ChatRoom.findOne({
      participants: { $all: [req.user.id, targetUserId], $size: 2 },
    });

    // 2) Reactivate an orphan room one party left (clearing its messages)
    //    - reusing the same roomId keeps data tidy and the DB from bloating
    //    - the old conversation is deleted (privacy, and a clean slate)
    if (!room) {
      const orphan = await ChatRoom.findOne({
        $or: [
          { participants: req.user.id, 'otherSnapshot.id': targetUserId },
          { participants: targetUserId, 'otherSnapshot.id': req.user.id },
        ],
      });
      if (orphan) {
        // Delete both the old messages and their notifications
        await Promise.all([
          Message.deleteMany({ roomId: orphan._id }),
          Notification.deleteMany({ roomId: orphan._id }),
        ]);
        // Add the missing participant back
        if (!orphan.participants.some(p => String(p) === String(req.user.id))) {
          orphan.participants.push(req.user.id);
        }
        if (!orphan.participants.some(p => String(p) === String(targetUserId))) {
          orphan.participants.push(targetUserId);
        }
        // Start a fresh request cycle — pending, with me as the requester
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

    // 3) Still nothing, so create a new room
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

// GET /api/chats/:roomId/messages — message list (paginated)
router.get('/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없어요.' });
    if (!room.participants.some(p => String(p) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: '접근 권한이 없어요.' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // Load what came before this message (infinite scroll)

    const query = { roomId: req.params.roomId };
    if (before) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'nickname');

    // Mark as read
    await Message.updateMany(
      { roomId: req.params.roomId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    // Reset my unread count
    await ChatRoom.findByIdAndUpdate(req.params.roomId, {
      $set: { [`unreadCount.${req.user.id}`]: 0 },
    });

    // Intro-board chats never reveal the real nickname, for either side
    const anonymous = !!room.introPostId;

    // Stringify senderId so the client can compare it against me.id
    const formatted = messages.reverse().map(m => ({
      id: m._id,
      roomId: m.roomId,
      senderId: m.senderId?._id ?? m.senderId,
      senderNickname: anonymous ? '소개팅 상대' : (m.senderId?.nickname ?? '알 수 없음'),
      content: m.content,
      readBy: m.readBy,
      createdAt: m.createdAt,
    }));

    // Group chats have no otherLeft/otherDeleted notion
    let otherLeft = false;
    let otherDeleted = false;
    // Only DMs track whether the other party left or deleted their account (meaningless for N-person group/school rooms)
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
        // School president ID — the client compares it to a message sender to show the ⭐ badge
        leaderUserId: await University.findOne({ name: room.university })
          .select('leaderUserId').lean()
          .then(u => u?.leaderUserId || null),
      } : undefined,
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// PUT /api/chats/:roomId/accept — accept a chat request (recipient only)
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
    // Auto-read the chat_request notification for this room
    // (covers accepting straight from the chat tab without tapping the notification card)
    Notification.updateMany(
      { userId: req.user.id, type: 'chat_request', roomId: room._id, isRead: false },
      { $set: { isRead: true } }
    ).catch(() => {});
    res.json({ success: true, data: { id: room._id, status: room.status } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/chats/:roomId — leave the room
// Leaving removes me from participants; once both are gone the room and messages are deleted outright
router.delete('/:roomId', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없어요.' });
    if (!room.participants.some(p => String(p) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: '권한이 없어요.' });
    }
    // Leaving a group chat means leaving the group itself
    if (room.kind === 'group') {
      return res.status(400).json({
        success: false,
        message: '그룹 채팅방은 모임에서 나가야 떠날 수 있어요.',
      });
    }
    // School-wide chat: remove myself from participants (the room stays)
    if (room.kind === 'school') {
      room.participants = room.participants.filter(p => String(p) !== String(req.user.id));
      await room.save();
      return res.json({ success: true, data: { message: '나갔어요.' } });
    }

    // Grab the other party's ID before leaving
    const otherId = room.participants.find(p => String(p) !== String(req.user.id));

    // Auto-read the chat_request notification for this room
    // (declining or leaving resolves the request, so its notification is cleaned up too)
    Notification.updateMany(
      { userId: req.user.id, type: 'chat_request', roomId: room._id, isRead: false },
      { $set: { isRead: true } }
    ).catch(() => {});

    // Snapshot the leaver's details so the other party can still see a nickname later
    const leaver = await User.findById(req.user.id).select('nickname avatarUrl');

    // Remove myself from participants
    room.participants = room.participants.filter(p => String(p) !== String(req.user.id));

    if (room.participants.length === 0) {
      // Both gone — delete the room and its messages outright
      await Message.deleteMany({ roomId: room._id });
      await room.deleteOne();
    } else {
      // Snapshot the leaver's details for the other party
      if (leaver) {
        room.otherSnapshot = {
          id: leaver._id,
          nickname: leaver.nickname,
          avatarUrl: leaver.avatarUrl,
        };
      }
      await room.save();
    }

    // Tell the other party over the socket
    // 1) the chat room socket room (if they are on the chat screen)
    // 2) their personal user_{id} room (wherever they happen to be)
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

// GET /api/chats/check/:userId — check the chat state with a given user
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
