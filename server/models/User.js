const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, maxlength: 200 },
  // Social signups may have no password (Apple/Google login)
  passwordHash: { type: String, default: null },
  // Social login identifiers (auto-linked by email)
  appleSub:  { type: String, default: null, sparse: true, index: true },
  googleSub: { type: String, default: null, sparse: true, index: true },
  nickname: { type: String, required: true, unique: true, maxlength: 30 },
  location: { type: String, default: '', maxlength: 100 },
  school: { type: String, default: '', maxlength: 200 },
  bio: { type: String, default: '', maxlength: 500 },
  avatarUrl: { type: String, default: '', maxlength: 500 },
  role: {
    type: String,
    enum: ['admin', 'student', 'working_holiday', 'general'],
    default: 'general',
  },
  verified: {
    type: Boolean,
    default: false,
  },
  university: {
    type: String,
    default: '',
    maxlength: 200,
  },
  city: {
    type: String,
    default: '',
    maxlength: 100,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerifyCode: { type: String, default: '' },
  emailVerifyExpires: { type: Date, default: null },
  resetCode: { type: String, default: '' },
  resetExpires: { type: Date, default: null },
  // Login lockout (brute-force defence)
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  // JWT invalidation — bumping this on a password change or reset expires every existing token
  tokenVersion: { type: Number, default: 0 },
  pushToken: {
    type: String,
    default: '',
  },
  // Account status — for admin enforcement
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'deleted'],
    default: 'active',
    index: true,
  },
  suspendedUntil: { type: Date, default: null }, // Null with status=suspended means indefinite
  suspendReason:  { type: String, default: '', maxlength: 500 },
  // Account deletion (soft delete) — recorded alongside status='deleted'
  deletedAt:    { type: Date, default: null },
  deleteReason: { type: String, default: '', maxlength: 500 },
  warningCount:   { type: Number, default: 0 },
  shadowBanned:   { type: Boolean, default: false }, // The user is not told, and their posts are invisible to everyone else
  notificationSettings: {
    enabled:    { type: Boolean, default: true }, // Master switch
    comment:    { type: Boolean, default: true }, // Comments on my posts
    reply:      { type: Boolean, default: true }, // Replies to my comments
    like:       { type: Boolean, default: true }, // Likes
    chat:       { type: Boolean, default: true }, // Chat messages
    notice:     { type: Boolean, default: true }, // Announcements
  },
}, { timestamps: true });

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
