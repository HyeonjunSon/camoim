const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  content: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false }, // 댓글 고정 (게시글 작성자만 가능)
  isSecret: { type: Boolean, default: false }, // 잠금 댓글 (작성자 + 글 작성자만 열람 가능)
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
