import { getRuntimeLang } from '../lib/runtimeLang';

export const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  WORKING_HOLIDAY: 'working_holiday',
  GENERAL: 'general',
};

const ROLE_LABELS_KO = {
  admin: '관리자',
  student: '유학생',
  working_holiday: '워홀',
  general: '일반',
};
const ROLE_LABELS_EN = {
  admin: 'Admin',
  student: 'Student',
  working_holiday: 'Working Holiday',
  general: 'General',
};

export const ROLE_LABELS = ROLE_LABELS_KO;

export function getRoleLabel(role, t) {
  if (t) {
    const v = t(`roles.${role}`);
    if (v && v !== `roles.${role}`) return v;
  }
  const lang = getRuntimeLang();
  const map = lang === 'en' ? ROLE_LABELS_EN : ROLE_LABELS_KO;
  return map[role] || role;
}

// 역할별 색상
export const ROLE_COLORS = {
  admin: { bg: '#EDE9FF', text: '#7F77DD' },       // 보라
  student: { bg: '#E8F0FF', text: '#5B8DEF' },      // 파랑
  working_holiday: { bg: '#FFF3E0', text: '#F4A535' }, // 오렌지
  general: { bg: '#F0F0F0', text: '#888888' },       // 회색
};
