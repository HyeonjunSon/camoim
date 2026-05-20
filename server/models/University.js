const mongoose = require('mongoose');

// 학교 마스터 데이터
// name = 표시명 (예: "University of Toronto (UofT)") — Board.university / User.university와 동일한 키
// fullName = 공식 풀네임 (예: "University of Toronto") — 검색·정렬용
// active = false면 인증 신청·게시판 생성 등에서 노출 안 함 (운영용 비활성화)
const universitySchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, maxlength: 200 },
  fullName:  { type: String, required: true, maxlength: 200 },
  sortOrder: { type: Number, default: 0 },
  active:    { type: Boolean, default: true, index: true },
}, { timestamps: true });

universitySchema.index({ active: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('University', universitySchema);
