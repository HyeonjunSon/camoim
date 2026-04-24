const mongoose = require('mongoose');

const verifyRequestSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  university:     { type: String, required: true },          // 학교 이름 (shortName)
  studentType:    { type: String, enum: ['current', 'alumni'], required: true },
  graduationYear: { type: Number, default: null },           // 졸업생만 입력
  fileUrl:        { type: String, required: true },          // 업로드된 서류 경로
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:      { type: String, default: '' },             // 거절 사유 등
  reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:     { type: Date, default: null },
}, { timestamps: true });

// 본인 신청 상태 조회 + 관리자 pending 목록 조회 핫 쿼리
verifyRequestSchema.index({ userId: 1, createdAt: -1 });
verifyRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VerifyRequest', verifyRequestSchema);
