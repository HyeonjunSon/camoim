import { labelFor, type Lang } from './i18n/lang';

/** Mirrors server/constants/intro.js and the app's intro.* i18n strings. */
export const INTRO_GENDERS = [
  { key: 'male', label: '남성', labelEn: 'Man' },
  { key: 'female', label: '여성', labelEn: 'Woman' },
] as const;

export const INTRO_JOBS = [
  { key: 'student', label: '학생', labelEn: 'Student' },
  { key: 'office', label: '직장인', labelEn: 'Office worker' },
  { key: 'professional', label: '전문직', labelEn: 'Professional' },
  { key: 'business', label: '자영업', labelEn: 'Business owner' },
  { key: 'workinghol', label: '워홀', labelEn: 'Working holiday' },
] as const;

export const INTRO_CONTACT_TYPES = [
  { key: 'instagram', label: '인스타그램', labelEn: 'Instagram' },
  { key: 'kakao', label: '카카오톡 ID', labelEn: 'KakaoTalk ID' },
] as const;

export const INTRO_EXPIRY_DAYS = 30;

export function genderLabel(key: string | undefined, lang: Lang = 'ko'): string {
  const g = INTRO_GENDERS.find((x) => x.key === key);
  return g ? labelFor(g, lang) : '';
}

export function jobLabel(key: string | undefined, lang: Lang = 'ko'): string {
  const j = INTRO_JOBS.find((x) => x.key === key);
  return j ? labelFor(j, lang) : '';
}

/** Korean age, which is what the app shows beside a birth year (English: "Age 27", as the app does). */
export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date(), lang: Lang = 'ko'): string {
  if (!birthYear) return '';
  const age = now.getFullYear() - birthYear + 1;
  return lang === 'en' ? `Age ${age}` : `${age}세`;
}

/** The three rules the agreement gate shows, worded as the app words them. */
export const INTRO_RULES = [
  {
    title: '만 19세 이상이면 누구나',
    titleEn: 'Open to anyone 19+',
    description: '학교·이메일 인증 여부와 상관없이 로그인한 회원이면 이용할 수 있어요.',
    descriptionEn: 'Any logged-in member can use it, regardless of school or email verification.',
  },
  {
    title: '실명, 회사명, 연락처는 적지 않아요',
    titleEn: 'No real names, employers, or contact info',
    description: '지인을 소개할 땐 꼭 본인 동의를 먼저 받아 주세요.',
    descriptionEn: 'Always get consent first before introducing a friend.',
  },
  {
    title: '수락해야 대화가 시작돼요',
    titleEn: 'Chat opens only after acceptance',
    description: '신청을 받은 쪽이 수락하면 익명 채팅이 열려요. 거절은 상대에게 알리지 않아요.',
    descriptionEn: 'An anonymous chat opens once the recipient accepts. Declines are never shown to the sender.',
  },
] as const;

/** Genders tinted so a card reads at a glance, as the app's cards do. */
export const GENDER_COLORS: Record<string, string> = {
  male: '#1D4ED8',
  female: '#BE185D',
};
