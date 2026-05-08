const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  // dm: 1:1, group: 모임 단체, school: 학교 전체 채팅
  kind: { type: String, enum: ['dm', 'group', 'school'], default: 'dm', index: true },
  // 그룹 채팅이면 모임 ID + 캐시된 이름/커버 (목록 빠른 조회용)
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  groupName: { type: String, default: '' },
  groupCoverImage: { type: String, default: '' },
  // 학교 전체 채팅이면 학교명 (groupId 대용 — 학교당 1개)
  university: { type: String, default: '', index: true },

  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  // 읽지 않은 메시지 수 { userId: count }
  unreadCount: { type: Map, of: Number, default: {} },
  // 채팅 요청 상태: pending(수락 대기) / accepted(수락됨). 그룹 채팅은 항상 accepted.
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending', index: true },
  // 채팅을 먼저 건 사람 (요청자) — DM 전용
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // DM에서 상대가 나간 뒤에도 닉네임/아바타를 보여주기 위한 스냅샷
  otherSnapshot: {
    id: { type: mongoose.Schema.Types.ObjectId },
    nickname: String,
    avatarUrl: String,
  },
}, { timestamps: true });

// 두 참여자로 방 찾기용 인덱스
chatRoomSchema.index({ participants: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
