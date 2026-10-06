const mongoose = require('mongoose');

// A "chat request" against an IntroPost. Accepting one reveals the post's contact info to the
// requester and opens an anonymous ChatRoom (see routes/intro.js). Declining notifies no one.
const introRequestSchema = new mongoose.Schema({
  introPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntroPost', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 150 },
  // Snapshot of the requester's own stats at submit time (also saved to User.introDefaults)
  snapshot: {
    gender: { type: String, default: '' },
    birthYear: { type: Number, default: null },
    region: { type: String, default: '' },
    job: { type: String, default: '' },
  },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', default: null }, // Set once accepted
}, { timestamps: true });

// One active (pending/accepted) request per requester per post — re-applying after a decline is allowed
introRequestSchema.index({ introPostId: 1, requesterId: 1 });

module.exports = mongoose.model('IntroRequest', introRequestSchema);
