/**
 * Korean-business map constants, mirroring src/constants/businesses.js.
 *
 * ⚠️ The two halves of this screen use different city vocabularies, and mixing
 * them silently returns nothing:
 *
 *   Business.city     lowercase slug      'toronto'   (MAP_CITIES below)
 *   StayListing.city  capitalised English 'Toronto'   (src/lib/boards.ts CITIES)
 *
 * So the city filter has to be built from whichever mode the map is in.
 */
export const BUSINESS_CATEGORIES = [
  { key: 'food', label: '음식점', color: '#C2410C', soft: '#FFF4ED' },
  { key: 'cafe', label: '카페·베이커리', color: '#B45309', soft: '#FEF3C7' },
  { key: 'mart', label: '마트', color: '#047857', soft: '#ECFDF5' },
  { key: 'hair', label: '미용실', color: '#6D28D9', soft: '#F5F3FF' },
  { key: 'clinic', label: '병원·한의원', color: '#BE123C', soft: '#FFF1F2' },
  // `realty` exists in the server enum but is deliberately left out of the
  // picker: individual agent pins cluttered the map, and the app omits it too.
  { key: 'etc', label: '기타', color: '#374151', soft: '#F3F4F6' },
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]['key'];

const CATEGORY_MAP = new Map(BUSINESS_CATEGORIES.map((c) => [c.key as string, c]));

export function categoryOf(key: string | undefined) {
  return (
    CATEGORY_MAP.get(key ?? '') ?? { key: 'etc', label: '기타', color: '#374151', soft: '#F3F4F6' }
  );
}

/** Camera presets, not a restriction — a stay's address can be anywhere. */
export const MAP_CITIES = [
  { key: 'toronto', label: '토론토', lat: 43.6532, lng: -79.3832 },
  { key: 'vancouver', label: '밴쿠버', lat: 49.2827, lng: -123.1207 },
  { key: 'montreal', label: '몬트리올', lat: 45.5019, lng: -73.5674 },
  { key: 'calgary', label: '캘거리', lat: 51.0447, lng: -114.0719 },
  { key: 'edmonton', label: '에드먼턴', lat: 53.5461, lng: -113.4938 },
  { key: 'ottawa', label: '오타와', lat: 45.4215, lng: -75.6972 },
  { key: 'waterloo', label: '워털루', lat: 43.4643, lng: -80.5204 },
  { key: 'winnipeg', label: '위니펙', lat: 49.8951, lng: -97.1384 },
  { key: 'saskatoon', label: '사스카툰', lat: 52.1332, lng: -106.67 },
  { key: 'london', label: '런던(ON)', lat: 42.9849, lng: -81.2453 },
  { key: 'halifax', label: '핼리팩스', lat: 44.6488, lng: -63.5752 },
] as const;

export const DEFAULT_MAP_CITY = 'toronto';

const CITY_MAP = new Map(MAP_CITIES.map((c) => [c.key as string, c]));

export function mapCityOf(key: string | undefined) {
  return CITY_MAP.get(key ?? '') ?? MAP_CITIES[0];
}

/**
 * The stays API filters on the capitalised English name, so a map city slug has
 * to be translated before it goes in a stay query. Cities on the map that the
 * stay list does not know (Waterloo folds into Toronto on the server) return null.
 */
const SLUG_TO_STAY_CITY: Record<string, string> = {
  toronto: 'Toronto',
  vancouver: 'Vancouver',
  montreal: 'Montreal',
  calgary: 'Calgary',
  edmonton: 'Edmonton',
  ottawa: 'Ottawa',
  winnipeg: 'Winnipeg',
  saskatoon: 'Saskatoon',
  london: 'London',
  halifax: 'Halifax',
};

export function stayCityForSlug(slug: string): string | null {
  return SLUG_TO_STAY_CITY[slug] ?? null;
}

const STAY_CITY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_STAY_CITY).map(([slug, name]) => [name, slug])
);

/**
 * The other direction: a user's stored city (`User.city`, capitalised English)
 * into the slug the business endpoints filter on. Null for a city the map does
 * not cover, which callers should read as "no city filter" rather than "no
 * results" — Victoria and Quebec are real cities with no map preset.
 */
export function mapCitySlugFor(city: string | undefined): string | null {
  if (!city) return null;
  return STAY_CITY_TO_SLUG[city] ?? null;
}

/** Reasons the business report endpoint accepts. */
export const BUSINESS_REPORT_REASONS = [
  { value: 'closed', label: '폐업했어요' },
  { value: 'info', label: '정보가 사실과 달라요' },
  { value: 'spam', label: '스팸·중복 등록이에요' },
] as const;
