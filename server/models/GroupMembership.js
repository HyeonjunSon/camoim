const mongoose = require('mongoose');

// Group membership — one user's join record for one group
const groupMembershipSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: {
    type: String,
    enum: ['owner', 'manager', 'member'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'banned'],
    default: 'active',
    index: true,
  },
  // Per-group notification settings
  notifyPosts: { type: Boolean, default: false }, // New-post notifications (off by default)
  notifyChat: { type: Boolean, default: true },   // Chat notifications (on by default)
  joinedAt: { type: Date, default: Date.now },
  bannedReason: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

// A user can join a given group only once
groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });
// Fast lookup of the groups a user belongs to
groupMembershipSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('GroupMembership', groupMembershipSchema);
