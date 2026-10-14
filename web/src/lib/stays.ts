// Mirrors STAY_TYPES in src/constants/stays.js.
export const STAY_TYPE_LABELS: Record<string, string> = {
  minbak: '민박',
  roomrent: '룸렌트',
  homestay: '홈스테이',
  hasuk: '하숙',
};

export const STAY_TYPE_COLORS: Record<string, string> = {
  minbak: '#1D4ED8',
  roomrent: '#047857',
  homestay: '#C2410C',
  hasuk: '#6D28D9',
};

export function stayPrice(price?: number, unit?: string): string {
  if (price === undefined || price === null) return '';
  return `$${price.toLocaleString('en-CA')}/${unit === 'night' ? '박' : '월'}`;
}

/**
 * Amenity keys, mirroring STAY_CONDITIONS in server/models/StayListing.js, with
 * the Korean labels the app shows (src/lib/i18n.js, stay.c*).
 */
export const STAY_CONDITIONS: { key: string; label: string }[] = [
  { key: 'femaleOnly', label: '여성 전용' },
  { key: 'maleOnly', label: '남성 전용' },
  { key: 'anyGender', label: '남녀 무관' },
  { key: 'studentOnly', label: '학생 전용' },
  { key: 'privateRoom', label: '개인 방' },
  { key: 'sharedRoom', label: '공유 방' },
  { key: 'privateBath', label: '개인 화장실' },
  { key: 'sharedBath', label: '공용 화장실' },
  { key: 'mealIncluded', label: '식사 포함' },
  { key: 'cooking', label: '취사 가능' },
  { key: 'utilIncluded', label: '공과금 포함' },
  { key: 'furnished', label: '가구 포함' },
  { key: 'laundry', label: '세탁 가능' },
  { key: 'wifi', label: 'Wi-Fi 포함' },
  { key: 'parking', label: '주차 가능' },
  { key: 'noSmoking', label: '금연' },
  { key: 'petsOk', label: '반려동물 가능' },
  { key: 'immediate', label: '즉시 입주' },
  { key: 'shortTerm', label: '단기 가능' },
];

const CONDITION_LABELS = new Map(STAY_CONDITIONS.map((c) => [c.key, c.label]));

export function conditionLabel(key: string): string {
  return CONDITION_LABELS.get(key) ?? key;
}

export const STAY_TYPE_OPTIONS = [
  { key: 'roomrent', label: '룸렌트' },
  { key: 'homestay', label: '홈스테이' },
  { key: 'hasuk', label: '하숙' },
  { key: 'minbak', label: '민박' },
] as const;

/** Reasons the stay report endpoint accepts. */
export const STAY_REPORT_REASONS = [
  { value: 'taken', label: '이미 나간 방이에요' },
  { value: 'info', label: '정보가 사실과 달라요' },
  { value: 'spam', label: '스팸·중복 등록이에요' },
] as const;
