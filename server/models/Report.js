const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['post', 'comment', 'user', 'business', 'review', 'stay', 'intro'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }, // Points back to the parent post when a comment is reported
  // Author snapshot at report time — lets admins see who wrote it even after the author deletes their account
  targetAuthorId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetAuthorNickname:  { type: String, default: '' },
  targetIsAnonymous:     { type: Boolean, default: false },
  reason: {
    type: String,
    enum: ['spam', 'hate', 'illegal', 'adult', 'etc'],
    required: true,
  },
  detail: { type: String, default: '' }, // Details for the "other" reason
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNote: { type: String, default: '' },
}, { timestamps: true });

// Stops the same user reporting the same target twice
reportSchema.index({ reporterId: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
