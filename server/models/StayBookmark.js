const mongoose = require('mongoose');

// Stay bookmarks — same pattern as BusinessBookmark; its own collection keeps the unique index separate
const stayBookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stayId: { type: mongoose.Schema.Types.ObjectId, ref: 'StayListing', required: true, index: true },
}, { timestamps: true });

stayBookmarkSchema.index({ userId: 1, stayId: 1 }, { unique: true });

module.exports = mongoose.model('StayBookmark', stayBookmarkSchema);
