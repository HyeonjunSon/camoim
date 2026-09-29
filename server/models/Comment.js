const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  content: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false }, // Pinned comment (only the post author can pin)
  isSecret: { type: Boolean, default: false }, // Locked comment (visible only to its author and the post author)
  // Auto-hidden once reports pile up
  autoHidden:  { type: Boolean, default: false, index: true },
  reportCount: { type: Number, default: 0 },
}, { timestamps: true });

// Hot query: loading comments when a post detail page opens
commentSchema.index({ postId: 1, createdAt: 1 });
commentSchema.index({ userId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
