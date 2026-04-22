// 유저 역할 상수
const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  WORKING_HOLIDAY: 'working_holiday',
  GENERAL: 'general',
};

// 역할 표시 이름 (프론트용)
const ROLE_LABELS = {
  admin: '관리자',
  student: '학생',
  working_holiday: '워홀',
  general: '일반',
};

module.exports = { ROLES, ROLE_LABELS };
