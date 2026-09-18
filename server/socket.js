const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ChatRoom = require('./models/ChatRoom');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const GroupMembership = require('./models/GroupMembership');
const User = require('./models/User');
const { isChatBlocked } = require('./utils/blocks');
const { sendPush } = require('./utils/push');

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

  // JWT 인증 미들웨어 — REST requireAuth와 같은 기준 적용
  // (서명만 보면 로그아웃/비번변경/정지된 토큰으로도 30일간 소켓 연결이 가능했음)
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
      // 조회 실패는 통과 (requireAuth와 동일 — DB 일시 장애가 전체 채팅 단절로 번지지 않게)
    }
    socket.user = { id: decoded.id, nickname: decoded.nickname };
    next();
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

    // 메시지 전송 (DM + 그룹 채팅 모두)
    socket.on('send_message', async ({ roomId, content }) => {
      try {
        if (!content?.trim()) return;
        const trimmed = content.trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return;
        if (!room.participants.some(p => String(p) === String(userId))) return;

        const isGroup = room.kind === 'group';
        const isSchool = room.kind === 'school';
        // 그룹/학교 모두 N명 채팅이라 DM 전용 검사 (차단·승인 대기) 제외
        const isMultiUser = isGroup || isSchool;
        // 이번 메시지가 DM 요청의 첫 메시지인지 — 요청(메시지) 단위 지역 변수
        // (socket 객체에 두면 같은 소켓의 동시 전송끼리 플래그를 공유해 꼬일 수 있음)
        let isFirstRequestMessage = false;

        // DM: 차단 체크 + 요청 단계 1통 제한
        if (!isMultiUser) {
          const otherIdEarly = room.participants.find(p => String(p) !== String(userId));
          if (otherIdEarly && await isChatBlocked(userId, otherIdEarly)) {
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
            // 첫 요청 메시지 표시 — 메시지 저장 후 수신자에게 chat_request 알림 생성
            isFirstRequestMessage = true;
          }
        }

        // 메시지 저장
        const message = await Message.create({
          roomId,
          senderId: userId,
          content: trimmed,
          readBy: [userId],
        });

        // 다른 참여자(들)의 unread +1
        const otherIds = room.participants
          .map(p => String(p))
          .filter(id => id !== String(userId));

        // $inc로 원자적 증가 — 읽고(cur) 다시 쓰는(cur+1) 방식은 동시 전송 시
        // 두 요청이 같은 cur를 읽어 카운트 1개가 유실됨 (lost update)
        const incs = {};
        for (const oid of otherIds) incs[`unreadCount.${oid}`] = 1;
        await ChatRoom.updateOne(
          { _id: roomId },
          { $set: { lastMessage: trimmed, lastMessageAt: new Date() }, $inc: incs }
        );

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

        // 방 안의 모든 사람에게 전송
        io.to(roomId).emit('new_message', payload);

        // DM 첫 요청 메시지면 수신자 알림함에 chat_request 레코드 생성
        // (일반 채팅 메시지는 안 쌓지만, 요청은 사용자가 채팅탭 안 들어가면 모를 수 있어서 별도 알림)
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

        // 채팅 메시지는 알림함(Notification)에 안 쌓음 — 채팅탭 unread 뱃지로
        // 충분하고, 카톡/슬랙 등 표준 패턴. 실시간 chat_notification 이벤트만 발송
        let recipients = otherIds;
        if (isGroup) {
          // 그룹 채팅: notifyChat=true인 멤버에게만 실시간 알림
          const enabledMembers = await GroupMembership.find({
            groupId: room.groupId,
            userId: { $in: otherIds },
            status: 'active',
            notifyChat: true,
          }).distinct('userId');
          recipients = enabledMembers.map(String);
        }
        // 학교 채팅: 모든 참여자에게 실시간 (별도 토글 없음)

        for (const rid of recipients) {
          io.to(`user_${rid}`).emit('chat_notification', {
            roomId,
            kind: room.kind,
            senderNickname: socket.user.nickname,
            content: trimmed,
            groupName: isMultiUser ? room.groupName : undefined,
          });
        }

        // OS 푸시 알림 — 앱이 백그라운드/종료 상태일 때도 배너로 도착하게
        // (소켓 chat_notification은 앱이 켜져있을 때만 작동)
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
            // 마스터 OFF 또는 chat OFF면 푸시 skip
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
        // 레거시 채팅 알림이 남아있을 수 있어 한 번만 정리
        // (Option B 이후로는 채팅 알림 자체를 안 만들지만 옛 데이터 청소)
        await Notification.deleteMany({
          userId, roomId, type: { $in: ['chat', 'group_chat'] },
        });
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
