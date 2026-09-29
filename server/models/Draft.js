const mongoose = require('mongoose');

// Post drafts
// Holds what the user was writing in CreatePostScreen, reloaded from the hamburger button
// Only one of boardId / groupId is filled (both empty is fine — a draft started before a board was picked)
const draftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  title:   { type: String, default: '', maxlength: 500 },
  content: { type: String, default: '' }, // HTML or plain
  isAnonymous: { type: Boolean, default: false },
  images: [{ type: String, maxlength: 500 }],
  city:    { type: String, default: '', maxlength: 100 },
  tradeStatus: { type: String, enum: ['selling', 'sold'], default: 'selling' },
}, { timestamps: true });

// Newest-first list of the user's own drafts
draftSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Draft', draftSchema);
