const mongoose = require('mongoose');

const CATEGORIES = ['account', 'post', 'chat', 'block', 'verify', 'bug', 'feature', 'etc', 'ad'];

const inquirySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: CATEGORIES, required: true },
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true, maxlength: 5000 },
  // 디바이스 메타 (사용자에겐 안 보임)
  appVersion: { type: String, default: '' },
  platform:   { type: String, default: '' },
  osVersion:  { type: String, default: '' },
  deviceModel:{ type: String, default: '' },

  status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open', index: true },
  answer: { type: String, default: '' },
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  answeredAt: { type: Date, default: null },
}, { timestamps: true });

inquirySchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Inquiry', inquirySchema);
