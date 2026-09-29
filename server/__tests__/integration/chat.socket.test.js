// Backend E2E of the core flow: log in, send a chat message, receive it
// Stands up the real Express app, a real Socket.io server and an in-memory MongoDB,
// then verifies a message round trip between two real socket.io clients.
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

// Close any open sockets between tests
let openSockets = [];
function track(socket) { openSockets.push(socket); return socket; }
afterEach(async () => {
  openSockets.forEach((s) => s.disconnect());
  openSockets = [];
  await db.clear();
});

// Obtain a genuine token via HTTP login (socket auth uses the very same token)
async function login(user) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: DEFAULT_PASSWORD })
    .expect(200);
  return res.body.data.token;
}

describe('socket authentication', () => {
  it('rejects a connection with no token', async () => {
    await expect(connectClient(url, undefined)).rejects.toThrow(/토큰/);
  });

  it('rejects a connection with an invalid token', async () => {
    await expect(connectClient(url, 'garbage.token.value')).rejects.toThrow(/유효하지 않은/);
  });

  it('accepts a token obtained by logging in', async () => {
    const user = await createUser();
    const socket = track(await connectClient(url, await login(user)));
    expect(socket.connected).toBe(true);
  });

  it('rejects a token whose tokenVersion changed (logout or password change)', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    await expect(connectClient(url, token)).rejects.toThrow(/TOKEN_REVOKED/);
  });

  it('rejects a banned account', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne({ _id: user._id }, { $set: { status: 'banned' } });
    await expect(connectClient(url, token)).rejects.toThrow(/ACCOUNT_BANNED/);
  });

  it('rejects an account still within its suspension', async () => {
    const user = await createUser();
    const token = await login(user);
    await User.updateOne(
      { _id: user._id },
      { $set: { status: 'suspended', suspendedUntil: new Date(Date.now() + 60 * 60 * 1000) } }
    );
    await expect(connectClient(url, token)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });
});

describe('log in, send a message, receive it (the core flow)', () => {
  it('the sent message reaches the other socket and is stored in the DB', async () => {
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
    // The sender's own message counts as already read
    expect(saved.readBy.map(String)).toEqual([String(alice._id)]);
  });

  it('the sender receives the same new_message (keeps the UI in sync)', async () => {
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

  it('sending raises the recipient unreadCount and refreshes the room preview', async () => {
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

  it('chat_notification arrives even without being inside the room', async () => {
    const alice = await createUser({ nickname: 'alice' });
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    const bobSocket = track(await connectClient(url, await login(bob)));
    aliceSocket.emit('join_room', roomId);
    // bob never calls join_room (he is sitting on the chat list screen)

    const notified = waitFor(bobSocket, 'chat_notification');
    aliceSocket.emit('send_message', { roomId, content: '안 읽었지?' });
    const payload = await notified;

    expect(payload.roomId).toBe(roomId);
    expect(payload.senderNickname).toBe('alice');
    expect(payload.content).toBe('안 읽었지?');
  });

  it('read_messages zeroes unread and tells the other party', async () => {
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

describe('send-message guards', () => {
  it('a non-participant cannot store a message', async () => {
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

  it('ignores empty and whitespace-only messages', async () => {
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

  it('trims surrounding whitespace before storing', async () => {
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

  it('returns send_error toward a chat-blocked user', async () => {
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

  it('in a pending DM the requester may send only one message', async () => {
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

  it('in a pending DM the recipient cannot send until accepting', async () => {
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

  it('sending to a nonexistent room does not crash the server', async () => {
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

describe('group chat', () => {
  it('a group room delivers to everyone with no block or approval checks', async () => {
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

  it('unreadCount survives simultaneous senders ($inc atomicity)', async () => {
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

    // Wait until carol has received every message (i.e. the server finished processing them all)
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

describe('message length limit (checked before the store and room update run in parallel)', () => {
  it('over 2000 characters returns send_error and leaves message, preview and unread untouched', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const err = waitFor(aliceSocket, 'send_error');
    aliceSocket.emit('send_message', { roomId, content: 'a'.repeat(2001) });
    expect((await err).message).toMatch(/2000/);

    expect(await Message.countDocuments({ roomId })).toBe(0);
    const after = await ChatRoom.findById(roomId);
    expect(after.lastMessage).toBe('');
    expect(after.unreadCount.get(String(bob._id)) ?? 0).toBe(0);
  });

  it('exactly 2000 characters is accepted', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await createDmRoom(alice, bob);
    const roomId = String(room._id);

    const aliceSocket = track(await connectClient(url, await login(alice)));
    aliceSocket.emit('join_room', roomId);

    const got = waitFor(aliceSocket, 'new_message');
    aliceSocket.emit('send_message', { roomId, content: 'a'.repeat(2000) });
    expect((await got).content).toHaveLength(2000);
  });
});
