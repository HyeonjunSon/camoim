const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  // 읽지 않은 메시지 수 { userId: count }
  unreadCount: { type: Map, of: Number, default: {} },
  // 채팅 요청 상태: pending(수락 대기) / accepted(수락됨)
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending', index: true },
  // 채팅을 먼저 건 사람 (요청자)
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // 상대가 나간 뒤에도 닉네임/아바타를 보여주기 위한 스냅샷
  otherSnapshot: {
    id: { type: mongoose.Schema.Types.ObjectId },
    nickname: String,
    avatarUrl: String,
  },
}, { timestamps: true });

// 두 참여자로 방 찾기용 인덱스
chatRoomSchema.index({ participants: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
