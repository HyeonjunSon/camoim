const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

noticeSchema.index({ pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Notice', noticeSchema);
