const mongoose = require('mongoose');

const verifyRequestSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  university:     { type: String, required: true },          // University name (shortName)
  studentType:    { type: String, enum: ['current', 'alumni'], required: true },
  graduationYear: { type: Number, default: null },           // Alumni only
  fileUrl:        { type: String, required: true },          // Path to the uploaded document
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:      { type: String, default: '' },             // Rejection reason and similar notes
  reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:     { type: Date, default: null },
}, { timestamps: true });

// Hot query: a user checking their own request, plus the admin pending list
verifyRequestSchema.index({ userId: 1, createdAt: -1 });
verifyRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VerifyRequest', verifyRequestSchema);
