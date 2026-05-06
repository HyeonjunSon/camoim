const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ChatRoom = require('./models/ChatRoom');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const { isChatBlocked } = require('./utils/blocks');

// 네이티브 모바일 앱 전용 — 브라우저 CORS 검증은 의미 없음.
// 일부 RN WebSocket 구현이 origin 헤더를 비어있지 않게 보내는 경우 락다운이
// 연결을 차단해서 실시간 메시지/알림이 끊김. 따라서 origin은 허용.
// 추후 웹 클라이언트 추가 시 SOCKET_CORS_ORIGINS env 화이트리스트로 다시 좁힘.
const SOCKET_ORIGINS = (process.env.SOCKET_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // 1) Origin 없는 요청 (대부분의 native 클라이언트) → 항상 허용
        if (!origin) return callback(null, true);
        // 2) 화이트리스트가 비어 있으면 (env 미설정) → 모든 origin 허용 (native-only 가정)
        if (SOCKET_ORIGINS.length === 0) return callback(null, true);
        // 3) 화이트리스트가 있으면 거기에 있는 origin만 허용
        if (SOCKET_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by Socket.io CORS'));
      },
    },
  });

  // JWT 인증 미들웨어
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('인증 토큰이 없습니다.'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id, nickname: decoded.nickname };
      next();
    } catch (err) {
      next(new Error('유효하지 않은 토큰입니다.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 소켓 연결: ${socket.user.nickname} (${userId})`);

    // 채팅방 입장
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
    });

    // 채팅방 퇴장 (화면 이동 시)
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });

    // 채팅방 나가기 (삭제) — 상대에게 알림
    socket.on('exit_room', async ({ roomId }) => {
      socket.to(roomId).emit('room_left', { roomId, userId });
      socket.leave(roomId);
    });

    // 메시지 전송
    socket.on('send_message', async ({ roomId, content }) => {
      try {
        if (!content?.trim()) return;

        const room = await ChatRoom.findById(roomId);
        if (!room) return;
        if (!room.participants.some(p => String(p) === String(userId))) return;

        // 차단 체크 (양방향)
        const otherIdEarly = room.participants.find(p => String(p) !== String(userId));
        if (otherIdEarly && await isChatBlocked(userId, otherIdEarly)) {
          socket.emit('send_error', { message: '차단된 사용자와는 채팅할 수 없어요.' });
          return;
        }

        // 채팅 요청 단계: 요청자만 1통, 수신자는 수락 전 발송 불가
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
        }

        // 메시지 저장
        const message = await Message.create({
          roomId,
          senderId: userId,
          content: content.trim(),
          readBy: [userId],
        });

        // 상대방 unread +1
        const otherId = room.participants.find(p => String(p) !== String(userId));
        if (otherId) {
          const currentUnread = room.unreadCount?.get(String(otherId)) ?? 0;
          await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: content.trim(),
            lastMessageAt: new Date(),
            $set: { [`unreadCount.${otherId}`]: currentUnread + 1 },
          });
        }

        const payload = {
          id: message._id,
          roomId,
          senderId: userId,
          senderNickname: socket.user.nickname,
          content: message.content,
          readBy: message.readBy,
          createdAt: message.createdAt,
        };

        // 방 안의 모든 사람에게 전송
        io.to(roomId).emit('new_message', payload);

        // 상대방 알림 저장 + 실시간 이벤트
        const preview = content.trim().length > 30 ? content.trim().slice(0, 30) + '…' : content.trim();
        await Notification.create({
          userId: otherId,
          type: 'chat',
          roomId,
          message: `${socket.user.nickname}: ${preview}`,
          isRead: false,
        });

        io.to(`user_${otherId}`).emit('chat_notification', {
          roomId,
          senderNickname: socket.user.nickname,
          content: content.trim(),
        });
      } catch (err) {
        console.error('메시지 전송 오류:', err);
      }
    });

    // 메시지 읽음 처리
    socket.on('read_messages', async ({ roomId }) => {
      try {
        // 아직 안 읽은 메시지에 내 ID 추가
        await Message.updateMany(
          { roomId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        // unread 카운트 초기화
        await ChatRoom.findByIdAndUpdate(roomId, {
          $set: { [`unreadCount.${userId}`]: 0 },
        });
        // 이 채팅방의 안 읽은 알림도 모두 읽음 처리
        await Notification.updateMany(
          { userId, type: 'chat', roomId, isRead: false },
          { $set: { isRead: true } }
        );
        // 룸 전체(본인 포함)에게 읽음 알림 전송 — 본인은 뱃지 갱신용
        io.to(roomId).emit('messages_read', { roomId, readerId: userId });
        // 본인 개인 룸에도 전송 (홈 알림 뱃지 갱신용, 채팅방 밖에 있을 때)
        io.to(`user_${userId}`).emit('messages_read', { roomId, readerId: userId });
      } catch (err) {
        console.error('읽음 처리 오류:', err);
      }
    });

    // 개인 알림용 룸 입장 (앱 실행 중일 때)
    socket.join(`user_${userId}`);

    socket.on('disconnect', () => {
      console.log(`🔌 소켓 해제: ${socket.user.nickname}`);
    });
  });

  return io;
}

module.exports = initSocket;
