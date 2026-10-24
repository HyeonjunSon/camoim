import { labelFor, type Lang } from './i18n/lang';

/** Mirrors VALID_CATEGORIES in server/routes/groups.js, labelled as the app does. */
export const GROUP_CATEGORIES = [
  { key: 'hobby', label: '취미', labelEn: 'Hobby' },
  { key: 'study', label: '스터디', labelEn: 'Study' },
  { key: 'local', label: '지역', labelEn: 'Local' },
  { key: 'job', label: '취업', labelEn: 'Career' },
  { key: 'workinghol', label: '워홀', labelEn: 'Working Holiday' },
  { key: 'general', label: '일반', labelEn: 'General' },
] as const;

export function groupCategoryLabel(key: string | undefined, lang: Lang = 'ko'): string {
  const c = GROUP_CATEGORIES.find((x) => x.key === key) ?? GROUP_CATEGORIES[GROUP_CATEGORIES.length - 1];
  return labelFor(c, lang);
}

export const GROUP_SORTS = [
  { key: 'popular', label: '멤버순', labelEn: 'Popular' },
  { key: 'recent', label: '최신순', labelEn: 'Recent' },
] as const;

export const GROUP_BOXES = [
  { key: 'all', label: '전체 모임', labelEn: 'All' },
  { key: 'mine', label: '내 모임', labelEn: 'Mine' },
] as const;
