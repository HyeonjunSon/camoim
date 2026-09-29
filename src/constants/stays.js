// Stay map — shared constants (the map, detail and create screens all import from here)
// Map cities match the business map (BUSINESS_CITIES is reused). Type colours are fixed regardless of theme.
import { BUSINESS_CITIES } from './businesses';

// Stay brand colours (pins, prices, emphasis) — same family as board.study in colors.js
export const STAY_ACCENT = '#3B82F6';
export const STAY_ACCENT_SOFT = '#EFF6FF';

// The four stay types — label is the Korean fallback for admins, labelKey is the i18n key
export const STAY_TYPES = [
  { key: 'minbak',   label: '민박',    labelKey: 'stay.tMinbak',   ion: 'bed',        color: '#3B82F6', soft: '#EFF6FF' },
  { key: 'roomrent', label: '룸렌트',  labelKey: 'stay.tRoomrent', ion: 'home',       color: '#10B981', soft: '#ECFDF5' },
  { key: 'homestay', label: '홈스테이',labelKey: 'stay.tHomestay', ion: 'people',     color: '#F97316', soft: '#FFF7ED' },
  { key: 'hasuk',    label: '하숙',    labelKey: 'stay.tHasuk',    ion: 'restaurant', color: '#8B5CF6', soft: '#F5F3FF' },
];

// Stay condition presets — kept in sync with the server's STAY_CONDITIONS keys
export const STAY_CONDITIONS = [
  { key: 'femaleOnly',   labelKey: 'stay.cFemaleOnly' },
  { key: 'maleOnly',     labelKey: 'stay.cMaleOnly' },
  { key: 'anyGender',    labelKey: 'stay.cAnyGender' },
  { key: 'studentOnly',  labelKey: 'stay.cStudentOnly' },
  { key: 'privateRoom',  labelKey: 'stay.cPrivateRoom' },
  { key: 'sharedRoom',   labelKey: 'stay.cSharedRoom' },
  { key: 'privateBath',  labelKey: 'stay.cPrivateBath' },
  { key: 'sharedBath',   labelKey: 'stay.cSharedBath' },
  { key: 'mealIncluded', labelKey: 'stay.cMealIncluded' },
  { key: 'cooking',      labelKey: 'stay.cCooking' },
  { key: 'utilIncluded', labelKey: 'stay.cUtilIncluded' },
  { key: 'furnished',    labelKey: 'stay.cFurnished' },
  { key: 'laundry',      labelKey: 'stay.cLaundry' },
  { key: 'wifi',         labelKey: 'stay.cWifi' },
  { key: 'parking',      labelKey: 'stay.cParking' },
  { key: 'noSmoking',    labelKey: 'stay.cNoSmoking' },
  { key: 'petsOk',       labelKey: 'stay.cPetsOk' },
  { key: 'immediate',    labelKey: 'stay.cImmediate' },
  { key: 'shortTerm',    labelKey: 'stay.cShortTerm' },
];

// Price unit — per month / per night
export const PRICE_UNITS = [
  { key: 'month', labelKey: 'stay.unitMonth' },
  { key: 'night', labelKey: 'stay.unitNight' },
];
export const priceUnitKey = (unit) => (unit === 'night' ? 'stay.perNight' : 'stay.perMonth');

// Reasons for reporting a stay (mapped to the server's reason keys)
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

// Rent display: $950/month. Only the currency symbol, regardless of locale (amounts are Canadian dollars)
export function formatPrice(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return `$${Number(n).toLocaleString('en-CA')}`;
}

// Move-in date display — stored as 'YYYY-MM-DD' (picked from the calendar) or 'immediate'.
// Older free-text values are shown as-is, for backward compatibility.
export function formatMoveIn(v, lang, t) {
  if (!v) return '';
  if (v === 'immediate') return t ? t('stay.moveInNow') : '즉시 입주';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v; // Legacy free text
  const [, y, mo, d] = m;
  const mn = Number(mo), dn = Number(d);
  if (lang === 'en') {
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${MON[mn - 1]} ${dn}, ${y}`;
  }
  return `${y}년 ${mn}월 ${dn}일`;
}

// Rich editor HTML to plain text (strips </p> and friends when a board post becomes a stay description)
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
