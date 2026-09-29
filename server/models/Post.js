const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // Set for regular board posts. Null for group posts.
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', default: null },
  // Set for group board posts. Null for regular boards.
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  images: [{ type: String }], // Attached image URLs (max 4)
  city: { type: String, default: '', index: true }, // Author's city (copied from their profile)
  // Admin moderation
  hidden:     { type: Boolean, default: false, index: true }, // Hidden by an admin
  hiddenReason: { type: String, default: '' },
  // Auto-hidden once reports pile up
  autoHidden:   { type: Boolean, default: false, index: true },
  reportCount:  { type: Number, default: 0 },
  pinned:     { type: Boolean, default: false }, // Pinned to the top of the board
  // Trade status, for marketplace-style boards (market, giveaway, car, roomrent)
  tradeStatus: { type: String, enum: ['selling', 'sold'], default: 'selling', index: true },
}, { timestamps: true });

// Exactly one of boardId / groupId must be present
postSchema.pre('validate', function (next) {
  if (!this.boardId && !this.groupId) {
    return next(new Error('A post needs either a boardId or a groupId.'));
  }
  next();
});

// Compound index for the hot queries — board listings, my posts and the home feed all ride on it
postSchema.index({ boardId: 1, createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likedBy: 1 });

module.exports = mongoose.model('Post', postSchema);
