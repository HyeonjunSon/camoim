// 한인 업체 지도 — 공통 상수 (지도/제보/관리 화면이 모두 여기서 import)
// 카테고리 색상은 테마 무관 고정값 (핀·칩 브랜드 컬러)

export const BUSINESS_CATEGORIES = [
  { key: 'food',   label: '음식점',        emoji: '🍽️', color: '#FB923C', soft: '#FFF4ED' },
  { key: 'cafe',   label: '카페·베이커리', emoji: '☕',  color: '#D97706', soft: '#FEF3C7' },
  { key: 'mart',   label: '마트',          emoji: '🛒',  color: '#10B981', soft: '#ECFDF5' },
  { key: 'hair',   label: '미용실',        emoji: '💇',  color: '#8B5CF6', soft: '#F5F3FF' },
  { key: 'clinic', label: '병원·한의원',   emoji: '🏥',  color: '#F43F5E', soft: '#FFF1F2' },
  // realty(부동산·이민)는 제외 — 개인 에이전트 핀이 지도를 어지럽혀서 뺌 (서버 스키마 enum엔 유지)
  { key: 'etc',    label: '기타',          emoji: '📍',  color: '#9CA3AF', soft: '#F3F4F6' },
];

// 지원 도시 + 지도 중심 좌표 (recenter 기준)
export const BUSINESS_CITIES = [
  { key: 'toronto',   label: '토론토',   latitude: 43.6532, longitude: -79.3832 },
  { key: 'vancouver', label: '밴쿠버',   latitude: 49.2827, longitude: -123.1207 },
  { key: 'montreal',  label: '몬트리올', latitude: 45.5019, longitude: -73.5674 },
];

// 도시 기본 확대 수준 (위/경도 delta)
export const CITY_REGION_DELTA = { latitudeDelta: 0.16, longitudeDelta: 0.16 };

const CAT_MAP = Object.fromEntries(BUSINESS_CATEGORIES.map((c) => [c.key, c]));
const CITY_MAP = Object.fromEntries(BUSINESS_CITIES.map((c) => [c.key, c]));

export const catOf = (key) => CAT_MAP[key] || CAT_MAP.etc;
export const cityOf = (key) => CITY_MAP[key] || BUSINESS_CITIES[0];
export const cityLabelOf = (key) => (CITY_MAP[key] ? CITY_MAP[key].label : key);

export const sourceLabelOf = (source) =>
  source === 'google' ? 'Google 제공' : source === 'admin' ? '운영진 등록' : '유저 정보';

// 업체 문제 신고 사유 (서버 reason 키와 매핑)
export const BUSINESS_REPORT_REASONS = [
  { key: 'closed', label: '폐업했어요' },
  { key: 'info',   label: '주소·전화 등 정보가 달라요' },
  { key: 'spam',   label: '스팸·중복 등록이에요' },
];

// 거리(km) 표시 포맷
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
