const mongoose = require('mongoose');

// Business reviews — 1-5 stars plus a one-liner. One review per user per business (editing = upsert)
// Average and count are denormalized onto Business.ratingAvg / ratingCount so list and map need no join
const businessReviewSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  text:       { type: String, default: '', trim: true, maxlength: 300 },
  nickname:   { type: String, default: '' }, // Snapshot at write time (the review survives account deletion)
}, { timestamps: true });

// One review per user
businessReviewSchema.index({ businessId: 1, userId: 1 }, { unique: true });
// Newest-first listing
businessReviewSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('BusinessReview', businessReviewSchema);
