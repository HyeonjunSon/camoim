// 숙소 지도 — 공통 상수 (지도/상세/등록 화면이 모두 여기서 import)
// 지도 도시는 업체와 동일 (BUSINESS_CITIES 재사용). 타입 색상은 테마 무관 고정값.
import { BUSINESS_CITIES } from './businesses';

// 숙소 브랜드 컬러 (핀·가격·강조) — colors.js board.study와 동일 계열
export const STAY_ACCENT = '#3B82F6';
export const STAY_ACCENT_SOFT = '#EFF6FF';

// 숙소 유형 4종 — label은 한국어 fallback(관리자용), labelKey는 i18n
export const STAY_TYPES = [
  { key: 'minbak',   label: '민박',    labelKey: 'stay.tMinbak',   ion: 'bed',        color: '#3B82F6', soft: '#EFF6FF' },
  { key: 'roomrent', label: '룸렌트',  labelKey: 'stay.tRoomrent', ion: 'home',       color: '#10B981', soft: '#ECFDF5' },
  { key: 'homestay', label: '홈스테이',labelKey: 'stay.tHomestay', ion: 'people',     color: '#F97316', soft: '#FFF7ED' },
  { key: 'hasuk',    label: '하숙',    labelKey: 'stay.tHasuk',    ion: 'restaurant', color: '#8B5CF6', soft: '#F5F3FF' },
];

// 숙소 조건 프리셋 — 서버 STAY_CONDITIONS 키와 동기화 유지
export const STAY_CONDITIONS = [
  { key: 'femaleOnly',   labelKey: 'stay.cFemaleOnly' },
  { key: 'maleOnly',     labelKey: 'stay.cMaleOnly' },
  { key: 'anyGender',    labelKey: 'stay.cAnyGender' },
  { key: 'studentOnly',  labelKey: 'stay.cStudentOnly' },
  { key: 'privateRoom',  labelKey: 'stay.cPrivateRoom' },
  { key: 'sharedRoom',   labelKey: 'stay.cSharedRoom' },
  { key: 'mealIncluded', labelKey: 'stay.cMealIncluded' },
  { key: 'utilIncluded', labelKey: 'stay.cUtilIncluded' },
  { key: 'furnished',    labelKey: 'stay.cFurnished' },
  { key: 'laundry',      labelKey: 'stay.cLaundry' },
  { key: 'wifi',         labelKey: 'stay.cWifi' },
  { key: 'immediate',    labelKey: 'stay.cImmediate' },
];

// 숙소 신고 사유 (서버 reason 키와 매핑)
export const STAY_REPORT_REASONS = [
  { key: 'taken', label: '이미 나간 방이에요',   labelKey: 'stay.reasonTaken' },
  { key: 'info',  label: '정보가 사실과 달라요', labelKey: 'stay.reasonInfo' },
  { key: 'spam',  label: '스팸·중복 등록이에요', labelKey: 'stay.reasonSpam' },
];

const TYPE_MAP = Object.fromEntries(STAY_TYPES.map((t) => [t.key, t]));
const COND_MAP = Object.fromEntries(STAY_CONDITIONS.map((c) => [c.key, c]));

export const stayTypeOf = (key) => TYPE_MAP[key] || STAY_TYPES[0];
export const stayCondOf = (key) => COND_MAP[key] || null;

export { BUSINESS_CITIES as STAY_CITIES };

// 월세 표기: $950/월. locale 무관하게 통화 기호만 (금액은 캐나다 달러)
export function formatPrice(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return `$${Number(n).toLocaleString('en-CA')}`;
}

// 리치에디터 HTML → 평문 (게시판 글을 숙소 소개로 옮길 때 </p> 등 태그 제거)
export function htmlToPlain(html) {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li)\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
