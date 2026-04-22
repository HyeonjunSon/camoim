const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['post', 'comment', 'user'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }, // 댓글 신고 시 원본 포스트 참조
  reason: {
    type: String,
    enum: ['spam', 'hate', 'illegal', 'adult', 'etc'],
    required: true,
  },
  detail: { type: String, default: '' }, // 기타 사유 상세
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNote: { type: String, default: '' },
}, { timestamps: true });

// 같은 유저가 같은 대상을 중복 신고 방지
reportSchema.index({ reporterId: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
