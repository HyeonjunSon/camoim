// 역할 상수 (프론트엔드용)
export const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  WORKING_HOLIDAY: 'working_holiday',
  GENERAL: 'general',
};

// i18n 키 기반 — getRoleLabel(role, t) 사용 권장
export const ROLE_LABELS = {
  admin: '관리자',
  student: '유학생',
  working_holiday: '워홀',
  general: '일반',
};

// t() 함수를 받아서 번역된 역할명 반환
export function getRoleLabel(role, t) {
  if (t) return t(`roles.${role}`) || ROLE_LABELS[role] || role;
  return ROLE_LABELS[role] || role;
}

// 역할별 색상
export const ROLE_COLORS = {
  admin: { bg: '#EDE9FF', text: '#7F77DD' },       // 보라
  student: { bg: '#E8F0FF', text: '#5B8DEF' },      // 파랑
  working_holiday: { bg: '#FFF3E0', text: '#F4A535' }, // 오렌지
  general: { bg: '#F0F0F0', text: '#888888' },       // 회색
};
