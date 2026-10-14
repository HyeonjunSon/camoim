/** Mirrors VALID_CATEGORIES in server/routes/groups.js, labelled as the app does. */
export const GROUP_CATEGORIES = [
  { key: 'hobby', label: '취미' },
  { key: 'study', label: '스터디' },
  { key: 'local', label: '지역' },
  { key: 'job', label: '취업' },
  { key: 'workinghol', label: '워홀' },
  { key: 'general', label: '일반' },
] as const;

const LABELS = new Map(GROUP_CATEGORIES.map((c) => [c.key as string, c.label]));

export function groupCategoryLabel(key: string | undefined): string {
  return LABELS.get(key ?? '') ?? '일반';
}

export const GROUP_SORTS = [
  { key: 'popular', label: '멤버순' },
  { key: 'recent', label: '최신순' },
] as const;

export const GROUP_BOXES = [
  { key: 'all', label: '전체 모임' },
  { key: 'mine', label: '내 모임' },
] as const;
