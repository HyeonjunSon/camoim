// 핵심 플로우 E2E(백엔드): 로그인 → 채팅 전송 → 수신
// 실제 Express 앱 + 실제 Socket.io 서버 + in-memory MongoDB를 그대로 띄우고,
// 두 개의 실제 socket.io 클라이언트로 메시지 왕복을 검증한다.
jest.mock('../../utils/mailer', () => ({
  generateCode: () => '123456',
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../utils/push', () => ({
  sendPush: jest.fn().mockResolvedValue(true),
  calculateUnreadBadge: jest.fn().mockResolvedValue(0),
}));

const http = require('http');
const request = require('supertest');
const db = require('../helpers/db');
const { createUser, createDmRoom, DEFAULT_PASSWORD } = require('../helpers/factories');
const { connectClient, waitFor, expectNoEvent } = require('../helpers/socket');

let app, httpServer, io, url;
let Message, ChatRoom, Block, User;

beforeAll(async () => {
  await db.connect();
  app = require('../../app');
  const initSocket = require('../../socket');
  Message = require('../../models/Message');
  ChatRoom = require('../../models/ChatRoom');
  Block = require('../../models/Block');
  User = require('../../models/User');

  httpServer = http.createServer(app);
  io = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
  await db.close();
});

// 열린 소켓을 테스트마다 정리
let openSockets = [];
function track(socket) { openSockets.push(socket); return socket; }
afterEach(async () => {
  openSockets.forEach((s) => s.disconnect());
  openSockets = [];
  await db.clear();
});

// HTTP 로그인으로 진짜 토큰을 받아온다 (소켓 인증도 이 토큰을 그대로 쓴다)
async function login(user) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: DEFAULT_PASSWORD })
    .expect(200);
  return res.body.data.token;
}

describe('소켓 인증', () => {
  it('토큰이 없으면 연결이 거부된다', async () => {
    await expect(connectClient(url, undefined)).rejects.toThrow(/토큰/);
  });

  it('잘못된 토큰이면 연결이 거부된다', async () => {
    await expect(connectClient(url, 'garbage.token.value')).rejects.toThrow(/유효하지 않은/);
  });

  it('로그인으로 받은 토큰이면 연결된다', async () => {
    const user = await createUser();
    const socket = track(await connectClient(url, await login(user)));
    expect(socket.connected).toBe(true);
  });

  it('tokenVersion이 바뀐(로그아웃·비번변경) 토큰은 거부된다', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    await expect(connectClient(url, token)).rejects.toThrow(/TOKEN_REVOKED/);
  });

  it('밴된 계정은 거부된다', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne({ _id: user._id }, { $set: { status: 'banned' } });
    await expect(connectClient(url, token)).rejects.toThrow(/ACCOUNT_BANNED/);
  });

  it('정지 기간이 남은 계정은 거부된다', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne(
      { _id: user._id },
      { $set: { status: 'suspended', suspendedUntil: new Date(Date.now() + 60 * 60 * 1000) } }
    );
    await expect(connectClient(url, token)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });
});

describe('로그인 → 메시지 전송 → 수신 (핵심 플로우)', () => {
  it('보낸 메시지가 상대 소켓에 도착하고 DB에 남는다', async () => {
    const alice = await createUser({ nickname: 'alice' });
    const bob = await createUser({ nickname: 'bob' });
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    aliceSocket.emit('join_room', roomId);
    bobSocket.emit('join_room', roomId);

    const received = waitFor(bobSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '안녕 Bob!' });
    const payload = await received;

    expect(payload.roomId).toBe(roomId);
    expect(payload.content).toBe('안녕 Bob!');
    expect(payload.senderId).toBe(String(alice._id));
    expect(payload.senderNickname).toBe('alice');
    expect(payload.kind).toBe('dm');

    const saved = await Message.findById(payload.id);
    expect(saved).not.toBeNull();
    expect(saved.content).toBe('안녕 Bob!');
    // 보낸 사람은 자기 메시지를 이미 읽은 것으로 처리
    expect(saved.readBy.map(String)).toEqual([String(alice._id)]);
  });

  it('보낸 사람도 같은 new_message를 받는다 (낙관적 UI 동기화)', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const echo = waitFor(aliceSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: 'echo' });
    expect((await echo).content).toBe('echo');
  });

  it('메시지를 보내면 상대의 unreadCount가 오르고 방 미리보기가 갱신된다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    aliceSocket.emit('join_room', roomId);
    bobSocket.emit('join_room', roomId);

    const got = waitFor(bobSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '첫 메시지' });
    await got;

    const updated = await ChatRoom.findById(roomId);
    expect(updated.lastMessage).toBe('첫 메시지');
    expect(updated.unreadCount.get(String(bob._id))).toBe(1);
    expect(updated.unreadCount.get(String(alice._id)) ?? 0).toBe(0);
  });

  it('채팅방에 들어와 있지 않아도 chat_notification은 받는다', async () => {
    const alice = await createUser({ nickname: 'alice' });
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    aliceSocket.emit('join_room', roomId);
    // bob은 join_room 하지 않음 (채팅 목록 화면에 있는 상황)

    const notified = waitFor(bobSocket, 'chat_notification');
    aliceSocket.emit('send_message', { roomId, content: '안 읽었지?' });
    const payload = await notified;

    expect(payload.roomId).toBe(roomId);
    expect(payload.senderNickname).toBe('alice');
    expect(payload.content).toBe('안 읽었지?');
  });

  it('read_messages로 읽음 처리하면 unread가 0이 되고 상대에게 알려준다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    aliceSocket.emit('join_room', roomId);
    bobSocket.emit('join_room', roomId);

    const delivered = waitFor(bobSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '읽어줘' });
    await delivered;

    const readEvent = waitFor(aliceSocket, 'messages_read');
    bobSocket.emit('read_messages', { roomId });
    const payload = await readEvent;

    expect(payload.roomId).toBe(roomId);
    expect(payload.readerId).toBe(String(bob._id));

    const updated = await ChatRoom.findById(roomId);
    expect(updated.unreadCount.get(String(bob._id))).toBe(0);
    const msg = await Message.findOne({ roomId });
    expect(msg.readBy.map(String)).toContain(String(bob._id));
  });
});

describe('메시지 전송 방어 로직', () => {
  it('방 참여자가 아니면 메시지가 저장되지 않는다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const stranger = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const bobSocket = track(await connectClient(url, await login(bob)));
    bobSocket.emit('join_room', roomId);
    const strangerSocket = track(await connectClient(url, await login(stranger)));

    strangerSocket.emit('send_message', { roomId, content: '끼어들기' });
    await expectNoEvent(bobSocket, 'new_message');
    expect(await Message.countDocuments({ roomId })).toBe(0);
  });

  it('빈 내용이나 공백만 있는 메시지는 무시한다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    bobSocket.emit('join_room', roomId);

    aliceSocket.emit('send_message', { roomId, content: '   ' });
    aliceSocket.emit('send_message', { roomId, content: '' });
    await expectNoEvent(bobSocket, 'new_message');
    expect(await Message.countDocuments({ roomId })).toBe(0);
  });

  it('앞뒤 공백은 잘라서 저장한다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const got = waitFor(aliceSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '  trimmed  ' });
    expect((await got).content).toBe('trimmed');
  });

  it('채팅 차단된 상대에게는 send_error가 돌아온다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);
    await Block.create({ blockerId: bob._id, blockedId: alice._id, blockChat: true });

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const err = waitFor(aliceSocket, 'send_error');
    aliceSocket.emit('send_message', { roomId, content: '차단됐나?' });
    expect((await err).message).toMatch(/차단/);
    expect(await Message.countDocuments({ roomId })).toBe(0);
  });

  it('pending DM에서 요청자는 한 통만 보낼 수 있다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob, { status: 'pending', requesterId: alice._id });
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const first = waitFor(aliceSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '안녕하세요!' });
    await first;

    const err = waitFor(aliceSocket, 'send_error');
    aliceSocket.emit('send_message', { roomId, content: '한 통 더' });
    expect((await err).message).toMatch(/한 통만/);
    expect(await Message.countDocuments({ roomId })).toBe(1);
  });

  it('pending DM에서 수신자는 수락 전까지 보낼 수 없다', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob, { status: 'pending', requesterId: alice._id });
    const roomId = String(room._id);

    const bobSocket = track(await connectClient(url, await login(bob)));
    bobSocket.emit('join_room', roomId);

    const err = waitFor(bobSocket, 'send_error');
    bobSocket.emit('send_message', { roomId, content: '먼저 답장' });
    expect((await err).message).toMatch(/수락/);
    expect(await Message.countDocuments({ roomId })).toBe(0);
  });

  it('없는 방으로 보내도 서버가 죽지 않는다', async () => {
    const alice = await createUser();
    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('send_message', {
      roomId: '000000000000000000000000',
      content: '유령방',
    });
    await expectNoEvent(aliceSocket, 'new_message');
    expect(aliceSocket.connected).toBe(true);
  });
});

describe('그룹 채팅', () => {
  it('그룹 방에서는 차단/승인 검사 없이 전원에게 전달된다', async () => {
    const alice = await createUser({ nickname: 'alice' });
    const bob = await createUser();
    const carol = await createUser();
    const room = await ChatRoom.create({
      kind: 'group',
      groupName: '토론토 러닝크루',
      participants: [alice._id, bob._id, carol._id],
      status: 'accepted',
    });
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    const carolSocket = track(await connectClient(url, await login(carol)));
    [aliceSocket, bobSocket, carolSocket].forEach((s) => s.emit('join_room', roomId));

    const bobGot = waitFor(bobSocket, 'new_message');
    const carolGot = waitFor(carolSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: '내일 7시 출발!' });

    const [b, c] = await Promise.all([bobGot, carolGot]);
    expect(b.content).toBe('내일 7시 출발!');
    expect(b.kind).toBe('group');
    expect(c.content).toBe('내일 7시 출발!');

    const updated = await ChatRoom.findById(roomId);
    expect(updated.unreadCount.get(String(bob._id))).toBe(1);
    expect(updated.unreadCount.get(String(carol._id))).toBe(1);
  });

  it('여러 명이 동시에 보내도 unreadCount가 유실되지 않는다 ($inc 원자성)', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const room = await ChatRoom.create({
      kind: 'group',
      groupName: '동시전송',
      participants: [alice._id, bob._id, carol._id],
      status: 'accepted',
    });
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    const carolSocket = track(await connectClient(url, await login(carol)));
    [aliceSocket, bobSocket, carolSocket].forEach((s) => s.emit('join_room', roomId));

    // carol이 전체 메시지를 다 받을 때까지 대기 (= 서버가 전부 처리 완료)
    const PER_SENDER = 10;
    const allArrived = new Promise((resolve) => {
      let n = 0;
      carolSocket.on('new_message', () => { if (++n === PER_SENDER * 2) resolve(); });
    });
    for (let i = 0; i < PER_SENDER; i++) {
      aliceSocket.emit('send_message', { roomId, content: `a${i}` });
      bobSocket.emit('send_message', { roomId, content: `b${i}` });
    }
    await allArrived;

    const updated = await ChatRoom.findById(roomId);
    expect(updated.unreadCount.get(String(carol._id))).toBe(PER_SENDER * 2);
    expect(updated.unreadCount.get(String(alice._id))).toBe(PER_SENDER);
    expect(updated.unreadCount.get(String(bob._id))).toBe(PER_SENDER);
  });
});
