const mongoose = require('mongoose');

// 학교 마스터 데이터
// name = 표시명 (예: "University of Toronto (UofT)") — Board.university / User.university와 동일한 키
// fullName = 공식 풀네임 (예: "University of Toronto") — 검색·정렬용
// active = false면 인증 신청·게시판 생성 등에서 노출 안 함 (운영용 비활성화)
// community: 학생회장이 꾸밀 수 있는 학교 커뮤니티 소개 카드 (소셜 링크 + 공지 한 줄)
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
  // 학생회장 — admin이 인증된 회원 중 한 명을 지정. 본인 학교 커뮤니티 카드만 편집 가능.
  leaderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  community: { type: communitySchema, default: () => ({}) },
}, { timestamps: true });

universitySchema.index({ active: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('University', universitySchema);
