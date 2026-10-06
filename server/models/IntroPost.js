const mongoose = require('mongoose');

// Intro board — fully anonymous, verified-members-only introductions.
// "self": the author posts about themselves. "proxy": the author posts about a friend
// (proxyConsent must be true — self-attested, not independently verified).
// Nothing here is ever shown with the author's real nickname/avatar; see routes/intro.js's formatIntro.
const INTRO_GENDERS = ['male', 'female'];
const INTRO_JOBS = ['student', 'office', 'professional', 'business', 'workinghol', ''];
const INTRO_CONTACT_TYPES = ['instagram', 'kakao', ''];
const INTRO_EXPIRY_DAYS = 30;

const introPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, enum: ['self', 'proxy'], required: true },
  proxyConsent: { type: Boolean, default: false }, // Required (must be true) when mode === 'proxy'

  gender: { type: String, enum: INTRO_GENDERS, required: true },
  birthYear: { type: Number, required: true, min: 1900, max: 2100 },
  region: { type: String, required: true, trim: true, maxlength: 40 },
  job: { type: String, enum: INTRO_JOBS, default: '' },
  height: { type: String, default: '', trim: true, maxlength: 20 },

  headline: { type: String, required: true, trim: true, maxlength: 60 },
  bio: { type: String, default: '', trim: true, maxlength: 1000 },

  // Birth years, not ages (e.g. 1994 = "94년생 이후"), matching the birthYear field above
  preferredBirthYearMin: { type: Number, default: null, min: 1900, max: 2100 },
  preferredBirthYearMax: { type: Number, default: null, min: 1900, max: 2100 },
  preferredRegion: { type: String, default: '', trim: true, maxlength: 40 },

  // Hidden from every response until the viewer has an accepted request on this post
  contactType: { type: String, enum: INTRO_CONTACT_TYPES, default: '' },
  contactValue: { type: String, default: '', trim: true, maxlength: 100 },

  status: { type: String, enum: ['active', 'closed', 'hidden'], default: 'active', index: true },
  expiresAt: { type: Date, required: true, index: true },

  reportCount: { type: Number, default: 0 },
  autoHidden: { type: Boolean, default: false },
}, { timestamps: true });

introPostSchema.index({ status: 1, expiresAt: 1, createdAt: -1 });
introPostSchema.index({ gender: 1, region: 1 });

module.exports = mongoose.model('IntroPost', introPostSchema);
module.exports.INTRO_GENDERS = INTRO_GENDERS;
module.exports.INTRO_JOBS = INTRO_JOBS;
module.exports.INTRO_CONTACT_TYPES = INTRO_CONTACT_TYPES;
module.exports.INTRO_EXPIRY_DAYS = INTRO_EXPIRY_DAYS;
