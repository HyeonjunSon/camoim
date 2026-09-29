// Helpers that build test users and chat rooms
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const ChatRoom = require('../../models/ChatRoom');

const DEFAULT_PASSWORD = 'test1234';

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = await User.create({
    email: `user-${suffix}@test.local`,
    nickname: `tester-${suffix}`,
    passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 4), // Tests use a low cost factor
    emailVerified: true,
    ...overrides,
  });
  return user;
}

function tokenFor(user) {
  return jwt.sign(
    { id: user._id, email: user.email, nickname: user.nickname, v: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function createDmRoom(userA, userB, overrides = {}) {
  return ChatRoom.create({
    kind: 'dm',
    participants: [userA._id, userB._id],
    status: 'accepted',
    requesterId: userA._id,
    ...overrides,
  });
}

module.exports = { createUser, tokenFor, createDmRoom, DEFAULT_PASSWORD };
