/** Mirrors server/constants/intro.js and the app's intro.* i18n strings. */
export const INTRO_GENDERS = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
] as const;

export const INTRO_JOBS = [
  { key: 'student', label: '학생' },
  { key: 'office', label: '직장인' },
  { key: 'professional', label: '전문직' },
  { key: 'business', label: '자영업' },
  { key: 'workinghol', label: '워홀' },
] as const;

export const INTRO_CONTACT_TYPES = [
  { key: 'instagram', label: '인스타그램' },
  { key: 'kakao', label: '카카오톡 ID' },
] as const;

export const INTRO_EXPIRY_DAYS = 30;

const GENDER_LABELS = new Map(INTRO_GENDERS.map((g) => [g.key as string, g.label]));
const JOB_LABELS = new Map(INTRO_JOBS.map((j) => [j.key as string, j.label]));

export function genderLabel(key: string | undefined): string {
  return GENDER_LABELS.get(key ?? '') ?? '';
}

export function jobLabel(key: string | undefined): string {
  return JOB_LABELS.get(key ?? '') ?? '';
}

/** Korean age, which is what the app shows beside a birth year. */
export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date()): string {
  if (!birthYear) return '';
  return `${now.getFullYear() - birthYear + 1}세`;
}

/** The three rules the agreement gate shows, worded as the app words them. */
export const INTRO_RULES = [
  {
    title: '만 19세 이상이면 누구나',
    description: '학교·이메일 인증 여부와 상관없이 로그인한 회원이면 이용할 수 있어요.',
  },
  {
    title: '실명, 회사명, 연락처는 적지 않아요',
    description: '지인을 소개할 땐 꼭 본인 동의를 먼저 받아 주세요.',
  },
  {
    title: '수락해야 대화가 시작돼요',
    description: '신청을 받은 쪽이 수락하면 익명 채팅이 열려요. 거절은 상대에게 알리지 않아요.',
  },
] as const;

/** Genders tinted so a card reads at a glance, as the app's cards do. */
export const GENDER_COLORS: Record<string, string> = {
  male: '#1D4ED8',
  female: '#BE185D',
};
