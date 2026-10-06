const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  // dm: 1:1, group: club/meetup room, school: university-wide room
  kind: { type: String, enum: ['dm', 'group', 'school'], default: 'dm', index: true },
  // Group chats: the group ID plus a cached name/cover, which keeps list queries fast
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  groupName: { type: String, default: '' },
  groupCoverImage: { type: String, default: '' },
  // School chats: the university name, standing in for groupId (one room per school)
  university: { type: String, default: '', index: true },

  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  // Unread message counts, { userId: count }
  unreadCount: { type: Map, of: Number, default: {} },
  // Chat request state: pending (awaiting accept) / accepted. Group chats are always accepted.
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending', index: true },
  // Whoever opened the chat (the requester) — DM only
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Set when this DM was opened from an accepted intro-board request. Both sides are
  // rendered anonymously (no nickname/avatar) in a room with this set — see ChatRoomScreen/ChatListScreen.
  introPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntroPost', default: null, index: true },
  // Snapshot so a nickname/avatar still renders after the other party leaves a DM
  otherSnapshot: {
    id: { type: mongoose.Schema.Types.ObjectId },
    nickname: String,
    avatarUrl: String,
  },
}, { timestamps: true });

// Index for finding a room by its two participants
chatRoomSchema.index({ participants: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
