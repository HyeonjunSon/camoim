// Mirrors STAY_TYPES in src/constants/stays.js.
export const STAY_TYPE_LABELS: Record<string, string> = {
  minbak: '민박',
  roomrent: '룸렌트',
  homestay: '홈스테이',
  hasuk: '하숙',
};

const STAY_TYPE_LABELS_EN: Record<string, string> = {
  minbak: 'Minbak',
  roomrent: 'Room Rent',
  homestay: 'Homestay',
  hasuk: 'Boarding',
};

export function stayTypeLabel(type: string, lang: 'ko' | 'en' = 'ko'): string {
  return (lang === 'en' ? STAY_TYPE_LABELS_EN[type] : STAY_TYPE_LABELS[type]) ?? (lang === 'en' ? 'Stay' : '숙소');
}

export const STAY_TYPE_COLORS: Record<string, string> = {
  minbak: '#1D4ED8',
  roomrent: '#047857',
  homestay: '#C2410C',
  hasuk: '#6D28D9',
};

export function stayPrice(price?: number, unit?: string, lang: 'ko' | 'en' = 'ko'): string {
  if (price === undefined || price === null) return '';
  const per = lang === 'en' ? (unit === 'night' ? 'night' : 'mo') : unit === 'night' ? '박' : '월';
  return `$${price.toLocaleString('en-CA')}/${per}`;
}

/**
 * Amenity keys, mirroring STAY_CONDITIONS in server/models/StayListing.js, with
 * the Korean labels the app shows (src/lib/i18n.js, stay.c*).
 */
export const STAY_CONDITIONS: { key: string; label: string; labelEn?: string }[] = [
  { key: 'femaleOnly', label: '여성 전용', labelEn: 'Women only' },
  { key: 'maleOnly', label: '남성 전용', labelEn: 'Men only' },
  { key: 'anyGender', label: '남녀 무관', labelEn: 'Any gender' },
  { key: 'studentOnly', label: '학생 전용', labelEn: 'Students only' },
  { key: 'privateRoom', label: '개인 방', labelEn: 'Private room' },
  { key: 'sharedRoom', label: '공유 방', labelEn: 'Shared room' },
  { key: 'privateBath', label: '개인 화장실', labelEn: 'Private bath' },
  { key: 'sharedBath', label: '공용 화장실', labelEn: 'Shared bath' },
  { key: 'mealIncluded', label: '식사 포함', labelEn: 'Meals included' },
  { key: 'cooking', label: '취사 가능', labelEn: 'Kitchen use' },
  { key: 'utilIncluded', label: '공과금 포함', labelEn: 'Utilities included' },
  { key: 'furnished', label: '가구 포함', labelEn: 'Furnished' },
  { key: 'laundry', label: '세탁 가능', labelEn: 'Laundry' },
  { key: 'wifi', label: 'Wi-Fi 포함', labelEn: 'Wi-Fi' },
  { key: 'parking', label: '주차 가능', labelEn: 'Parking' },
  { key: 'noSmoking', label: '금연', labelEn: 'No smoking' },
  { key: 'petsOk', label: '반려동물 가능', labelEn: 'Pets OK' },
  { key: 'immediate', label: '즉시 입주', labelEn: 'Move-in now' },
  { key: 'shortTerm', label: '단기 가능', labelEn: 'Short-term OK' },
];


export function conditionLabel(key: string, lang: 'ko' | 'en' = 'ko'): string {
  const c = STAY_CONDITIONS.find((x) => x.key === key);
  if (!c) return key;
  return lang === 'en' && c.labelEn ? c.labelEn : c.label;
}

export const STAY_TYPE_OPTIONS = [
  { key: 'roomrent', label: '룸렌트', labelEn: 'Room Rent' },
  { key: 'homestay', label: '홈스테이', labelEn: 'Homestay' },
  { key: 'hasuk', label: '하숙', labelEn: 'Boarding' },
  { key: 'minbak', label: '민박', labelEn: 'Minbak' },
] as const;

/** Reasons the stay report endpoint accepts. */
export const STAY_REPORT_REASONS = [
  { value: 'taken', label: '이미 나간 방이에요', labelEn: 'Room is already taken' },
  { value: 'info', label: '정보가 사실과 달라요', labelEn: 'Info is inaccurate' },
  { value: 'spam', label: '스팸·중복 등록이에요', labelEn: 'Spam or duplicate' },
] as const;
