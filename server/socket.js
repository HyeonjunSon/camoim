const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ChatRoom = require('./models/ChatRoom');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const GroupMembership = require('./models/GroupMembership');
const User = require('./models/User');
const { getBlockedUserIds } = require('./utils/blocks');
const { sendPush } = require('./utils/push');

// Native mobile app only — a browser CORS check buys us nothing here.
// Some RN WebSocket implementations send a non-empty origin header, and a lockdown
// then refuses the connection, cutting off live messages and alerts. So origins are allowed.
// If a web client is added later, narrow this again with the SOCKET_CORS_ORIGINS env whitelist.
const SOCKET_ORIGINS = (process.env.SOCKET_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // 1) No origin (most native clients) → always allow
        if (!origin) return callback(null, true);
        // 2) Empty whitelist (env unset) → allow every origin (native-only assumption)
        if (SOCKET_ORIGINS.length === 0) return callback(null, true);
        // 3) Whitelist present → allow only the origins it lists
        if (SOCKET_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by Socket.io CORS'));
      },
    },
  });

  // JWT auth middleware — same bar as the REST requireAuth
  // (checking the signature alone let logged-out, password-changed or suspended tokens hold a socket for 30 days)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('인증 토큰이 없습니다.'));
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error('유효하지 않은 토큰입니다.'));
    }
    try {
      const u = await User.findById(decoded.id).select('status suspendedUntil tokenVersion').lean();
      if (!u) return next(new Error('계정을 찾을 수 없습니다.'));
      if ((decoded.v || 0) !== (u.tokenVersion || 0)) return next(new Error('TOKEN_REVOKED'));
      if (u.status === 'banned' || u.status === 'deleted') return next(new Error('ACCOUNT_BANNED'));
      if (u.status === 'suspended' && (!u.suspendedUntil || new Date(u.suspendedUntil) > new Date())) {
        return next(new Error('ACCOUNT_SUSPENDED'));
      }
    } catch (e) {
      // A failed lookup passes through, as in requireAuth, so a transient DB fault does not sever all chat
    }
    socket.user = { id: decoded.id, nickname: decoded.nickname };
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 소켓 연결: ${socket.user.nickname} (${userId})`);

    // Join a chat room
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
    });

    // Leave the room view (on navigation away)
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });

    // Leave the room for good (delete) — notify the other party
    socket.on('exit_room', async ({ roomId }) => {
      socket.to(roomId).emit('room_left', { roomId, userId });
      socket.leave(roomId);
    });

    // Send a message (DMs and group chats alike)
    socket.on('send_message', async ({ roomId, content }) => {
      try {
        if (!content?.trim()) return;
        const trimmed = content.trim();

        // Anything over 2000 chars fails schema validation anyway — reject before writing (the app input is capped too)
        if (trimmed.length > 2000) {
          socket.emit('send_error', { message: '메시지는 2000자까지 보낼 수 있어요.' });
          return;
        }

        // Room lookup ‖ my chat block list (cached), in parallel — these used to run serially.
        // Fetching the block list before we know the room kind is near-free because it is cached.
        const [room, chatBlockedIds] = await Promise.all([
          ChatRoom.findById(roomId).lean(),
          getBlockedUserIds(userId, 'blockChat'),
        ]);
        if (!room) return;
        if (!room.participants.some(p => String(p) === String(userId))) return;

        const isGroup = room.kind === 'group';
        const isSchool = room.kind === 'school';
        // Group and school rooms are both N-person, so the DM-only checks (blocks, pending request) are skipped
        const isMultiUser = isGroup || isSchool;
        // Whether this message is the first of a DM request — scoped per message, not per socket
        // (on the socket object, concurrent sends from the same socket would share and corrupt the flag)
        let isFirstRequestMessage = false;

        // DM: block check plus the one-message limit while a request is pending
        if (!isMultiUser) {
          const otherIdEarly = room.participants.find(p => String(p) !== String(userId));
          if (otherIdEarly && chatBlockedIds.includes(String(otherIdEarly))) {
            socket.emit('send_error', { message: '차단된 사용자와는 채팅할 수 없어요.' });
            return;
          }
          if (room.status === 'pending') {
            if (String(room.requesterId) !== String(userId)) {
              socket.emit('send_error', { message: '아직 수락되지 않은 채팅이에요.' });
              return;
            }
            const already = await Message.countDocuments({ roomId, senderId: userId });
            if (already >= 1) {
              socket.emit('send_error', { message: '상대가 수락하기 전에는 메시지를 한 통만 보낼 수 있어요.' });
              return;
            }
            // Mark the first request message — after saving, raise a chat_request notification for the recipient
            isFirstRequestMessage = true;
          }
        }

        // Build and validate the message document with no DB round trip, because the two writes below fire together
        // and catching validation first prevents a state where the room preview and unread moved but no message exists
        const message = new Message({
          roomId,
          senderId: userId,
          content: trimmed,
          readBy: [userId],
        });
        await message.validate();

        // Bump the other participants' unread by 1
        const otherIds = room.participants
          .map(p => String(p))
          .filter(id => id !== String(userId));

        // Atomic $inc — a read-then-write (cur, then cur+1) loses a count when two sends
        // read the same cur (a lost update)
        const incs = {};
        for (const oid of otherIds) incs[`unreadCount.${oid}`] = 1;

        // Save the message ‖ update the room — independent, so they run together (this used to be two serial round trips).
        // Emitting only after both settle avoids the race where the recipient's read_messages (unread=0) lands
        // before the $inc and leaves an already-read message sitting at unread 1.
        await Promise.all([
          message.save(),
          ChatRoom.updateOne(
            { _id: roomId },
            { $set: { lastMessage: trimmed, lastMessageAt: new Date() }, $inc: incs }
          ),
        ]);

        const payload = {
          id: message._id,
          roomId,
          senderId: userId,
          senderNickname: socket.user.nickname,
          content: message.content,
          readBy: message.readBy,
          createdAt: message.createdAt,
          kind: room.kind,
        };

        // Broadcast to everyone in the room
        io.to(roomId).emit('new_message', payload);

        // On the first DM request message, add a chat_request record to the recipient's notifications
        // (ordinary chat messages are not stored, but a request would go unseen until they open the chat tab)
        if (isFirstRequestMessage && otherIds.length > 0) {
          for (const oid of otherIds) {
            Notification.create({
              userId: oid,
              type: 'chat_request',
              message: `${socket.user.nickname}님이 메시지 요청을 보냈어요.`,
              roomId,
            }).catch(() => {});
          }
        }

        // Chat messages are deliberately not stored as Notifications — the unread badge on the chat tab
        // is enough, and matches what KakaoTalk and Slack do. Only the live chat_notification event is emitted
        let recipients = otherIds;
        if (isGroup) {
          // Group chat: live notification only for members with notifyChat=true
          const enabledMembers = await GroupMembership.find({
            groupId: room.groupId,
            userId: { $in: otherIds },
            status: 'active',
            notifyChat: true,
          }).distinct('userId');
          recipients = enabledMembers.map(String);
        }
        // School chat: live notification for every participant (no per-member toggle)

        for (const rid of recipients) {
          io.to(`user_${rid}`).emit('chat_notification', {
            roomId,
            kind: room.kind,
            senderNickname: socket.user.nickname,
            content: trimmed,
            groupName: isMultiUser ? room.groupName : undefined,
          });
        }

        // OS push, so the banner still arrives when the app is backgrounded or killed
        // (the chat_notification socket event only works while the app is running)
        try {
          const recipientUsers = await User.find({
            _id: { $in: recipients },
          }).select('pushToken notificationSettings').lean();

          const titleBase = isMultiUser
            ? `${room.groupName} · ${socket.user.nickname}`
            : socket.user.nickname;
          const body = trimmed.length > 100 ? trimmed.slice(0, 100) + '…' : trimmed;

          await Promise.all(recipientUsers.map(u => {
            const ns = u.notificationSettings;
            // Skip the push when the master switch or the chat toggle is off
            if (!u.pushToken) return Promise.resolve();
            if (ns?.enabled === false) return Promise.resolve();
            if (ns?.chat === false) return Promise.resolve();
            return sendPush(
              u.pushToken,
              titleBase,
              body,
              { type: 'chat', roomId: String(roomId), kind: room.kind },
              u._id,
            );
          }));
        } catch (pushErr) {
          console.error('chat push error:', pushErr.message);
        }
      } catch (err) {
        console.error('메시지 전송 오류:', err);
      }
    });

    // Mark messages read
    socket.on('read_messages', async ({ roomId }) => {
      try {
        // The three writes are independent, so they run together (this used to be three serial round trips)
        await Promise.all([
          // Add my ID to messages that are still unread
          Message.updateMany(
            { roomId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
          ),
          // Reset the unread count
          ChatRoom.updateOne({ _id: roomId }, {
            $set: { [`unreadCount.${userId}`]: 0 },
          }),
          // Legacy chat notifications may linger — clean them up once
          // (since Option B we no longer create chat notifications, but old data still needs sweeping)
          Notification.deleteMany({
            userId, roomId, type: { $in: ['chat', 'group_chat'] },
          }),
        ]);
        // Tell the whole room, including the sender, so their own badge refreshes
        io.to(roomId).emit('messages_read', { roomId, readerId: userId });
        // Also send to the user's personal room, which refreshes the home badge while they are outside the chat
        io.to(`user_${userId}`).emit('messages_read', { roomId, readerId: userId });
      } catch (err) {
        console.error('읽음 처리 오류:', err);
      }
    });

    // Join the personal notification room (while the app is running)
    socket.join(`user_${userId}`);

    socket.on('disconnect', () => {
      console.log(`🔌 소켓 해제: ${socket.user.nickname}`);
    });
  });

  return io;
}

module.exports = initSocket;
