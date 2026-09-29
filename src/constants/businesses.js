// Korean business map — shared constants (the map, submission and admin screens all import from here)
// Category colours are fixed regardless of theme (brand colours for pins and chips); icons come from the single source in lib/icons.js
import { BIZ_CATEGORY_ICONS } from '../lib/icons';

// label = Korean fallback for the admin screens, labelKey = i18n key (user-facing screens use t(labelKey))
export const BUSINESS_CATEGORIES = [
  { key: 'food',   label: '음식점',        labelKey: 'biz.catFood',   ion: BIZ_CATEGORY_ICONS.food.ion,   color: '#FB923C', soft: '#FFF4ED' },
  { key: 'cafe',   label: '카페·베이커리', labelKey: 'biz.catCafe',   ion: BIZ_CATEGORY_ICONS.cafe.ion,   color: '#D97706', soft: '#FEF3C7' },
  { key: 'mart',   label: '마트',          labelKey: 'biz.catMart',   ion: BIZ_CATEGORY_ICONS.mart.ion,   color: '#10B981', soft: '#ECFDF5' },
  { key: 'hair',   label: '미용실',        labelKey: 'biz.catHair',   ion: BIZ_CATEGORY_ICONS.hair.ion,   color: '#8B5CF6', soft: '#F5F3FF' },
  { key: 'clinic', label: '병원·한의원',   labelKey: 'biz.catClinic', ion: BIZ_CATEGORY_ICONS.clinic.ion, color: '#F43F5E', soft: '#FFF1F2' },
  // realty (real estate and immigration) is left out — individual agent pins cluttered the map (the enum stays in the server schema)
  { key: 'etc',    label: '기타',          labelKey: 'biz.catEtc',    ion: BIZ_CATEGORY_ICONS.etc.ion,    color: '#9CA3AF', soft: '#F3F4F6' },
];

// "Jump to" city shortcuts and their centre coordinates (used for recentring). A camera preset, not a restriction.
// Stays are not limited by city (an address can be anywhere). These are the Canadian cities with large Korean populations.
export const BUSINESS_CITIES = [
  { key: 'toronto',   label: '토론토',   labelKey: 'biz.cityToronto',   latitude: 43.6532,  longitude: -79.3832 },
  { key: 'vancouver', label: '밴쿠버',   labelKey: 'biz.cityVancouver', latitude: 49.2827,  longitude: -123.1207 },
  { key: 'montreal',  label: '몬트리올', labelKey: 'biz.cityMontreal',  latitude: 45.5019,  longitude: -73.5674 },
  { key: 'calgary',   label: '캘거리',   labelKey: 'biz.cityCalgary',   latitude: 51.0447,  longitude: -114.0719 },
  { key: 'edmonton',  label: '에드먼턴', labelKey: 'biz.cityEdmonton',  latitude: 53.5461,  longitude: -113.4938 },
  { key: 'ottawa',    label: '오타와',   labelKey: 'biz.cityOttawa',    latitude: 45.4215,  longitude: -75.6972 },
  { key: 'waterloo',  label: '워털루',   labelKey: 'biz.cityWaterloo',  latitude: 43.4643,  longitude: -80.5204 },
  { key: 'winnipeg',  label: '위니펙',   labelKey: 'biz.cityWinnipeg',  latitude: 49.8951,  longitude: -97.1384 },
  { key: 'saskatoon', label: '사스카툰', labelKey: 'biz.citySaskatoon', latitude: 52.1332,  longitude: -106.6700 },
  { key: 'london',    label: '런던(ON)', labelKey: 'biz.cityLondon',    latitude: 42.9849,  longitude: -81.2453 },
  { key: 'halifax',   label: '핼리팩스', labelKey: 'biz.cityHalifax',   latitude: 44.6488,  longitude: -63.5752 },
];

// Default zoom per city (latitude/longitude delta)
export const CITY_REGION_DELTA = { latitudeDelta: 0.16, longitudeDelta: 0.16 };

const CAT_MAP = Object.fromEntries(BUSINESS_CATEGORIES.map((c) => [c.key, c]));
const CITY_MAP = Object.fromEntries(BUSINESS_CITIES.map((c) => [c.key, c]));

export const catOf = (key) => CAT_MAP[key] || CAT_MAP.etc;
export const cityOf = (key) => CITY_MAP[key] || BUSINESS_CITIES[0];
export const cityLabelOf = (key) => (CITY_MAP[key] ? CITY_MAP[key].label : key);
export const cityLabelKeyOf = (key) => (CITY_MAP[key] ? CITY_MAP[key].labelKey : null);

export const sourceLabelOf = (source) =>
  source === 'google' ? 'Google 제공' : source === 'admin' ? '운영진 등록' : '유저 정보';
export const sourceKeyOf = (source) =>
  source === 'google' ? 'biz.srcGoogle' : source === 'admin' ? 'biz.srcAdmin' : 'biz.srcUser';

// Reasons for reporting a business (mapped to the server's reason keys)
export const BUSINESS_REPORT_REASONS = [
  { key: 'closed', label: '폐업했어요',              labelKey: 'biz.reasonClosed' },
  { key: 'info',   label: '주소·전화 등 정보가 달라요', labelKey: 'biz.reasonInfo' },
  { key: 'spam',   label: '스팸·중복 등록이에요',      labelKey: 'biz.reasonSpam' },
];

// Distance (km) display format
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
