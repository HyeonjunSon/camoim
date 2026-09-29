const mongoose = require('mongoose');

// Business bookmarks — kept apart from post Bookmark to avoid schema/unique-index collisions
const businessBookmarkSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
}, { timestamps: true });

businessBookmarkSchema.index({ userId: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.model('BusinessBookmark', businessBookmarkSchema);
