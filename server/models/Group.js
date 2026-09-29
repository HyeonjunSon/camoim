const mongoose = require('mongoose');

// community: social links plus a notice the group owner curates (same pattern as the school community card)
const communitySchema = new mongoose.Schema({
  instagram: { type: String, default: '', maxlength: 300 },
  kakaoOpen: { type: String, default: '', maxlength: 300 },
  discord:   { type: String, default: '', maxlength: 300 },
  homepage:  { type: String, default: '', maxlength: 300 },
  notice:    { type: String, default: '', maxlength: 500 },
}, { _id: false });

// User-created interest groups
// Activated after admin approval. Once active, a board and a group chat are wired up automatically.
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, default: '', maxlength: 500 },
  coverImage: { type: String, default: '', maxlength: 500 }, // Cloudinary URL
  category: {
    type: String,
    enum: ['hobby', 'study', 'local', 'job', 'workinghol', 'general'],
    default: 'general',
    index: true,
  },
  city: { type: String, default: '', maxlength: 100, index: true }, // Set for local groups
  // University-only club: empty string = open to all, a value restricts it to verified members of that school
  university: { type: String, default: '', maxlength: 100, index: true },

  // Owner + co-owners
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  managerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Cached counts
  memberCount: { type: Number, default: 1 },
  postCount: { type: Number, default: 0 },

  // Join policy
  joinPolicy: { type: String, enum: ['open', 'approval'], default: 'open' },
  maxMembers: { type: Number, default: 500 },

  // Admin approval workflow
  status: {
    type: String,
    enum: ['pending_review', 'active', 'rejected', 'closed'],
    default: 'pending_review',
    index: true,
  },
  rejectReason: { type: String, default: '', maxlength: 500 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },

  // Social/notice card curated by the owner (or a co-owner)
  community: { type: communitySchema, default: () => ({}) },
}, { timestamps: true });

groupSchema.index({ status: 1, category: 1, createdAt: -1 });
groupSchema.index({ status: 1, memberCount: -1 });
groupSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Group', groupSchema);
