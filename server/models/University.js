const mongoose = require('mongoose');

// University master data
// name = display name, e.g. "University of Toronto (UofT)" — the same key as Board.university / User.university
// fullName = official full name, e.g. "University of Toronto" — used for search and sorting
// active = false hides the school from verification requests, board creation and so on (ops kill switch)
// community: the school community card a student president curates (social links + a one-line notice)
const communitySchema = new mongoose.Schema({
  instagram: { type: String, default: '', maxlength: 300 },
  kakaoOpen: { type: String, default: '', maxlength: 300 },
  discord:   { type: String, default: '', maxlength: 300 },
  homepage:  { type: String, default: '', maxlength: 300 },
  notice:    { type: String, default: '', maxlength: 500 },
}, { _id: false });

const universitySchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, maxlength: 200 },
  fullName:  { type: String, required: true, maxlength: 200 },
  sortOrder: { type: Number, default: 0 },
  active:    { type: Boolean, default: true, index: true },
  // Student president — an admin picks one verified member, who can edit only their own school's community card.
  leaderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  community: { type: communitySchema, default: () => ({}) },
}, { timestamps: true });

universitySchema.index({ active: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('University', universitySchema);
