import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import MapExplorer, { type MapMode } from '@/components/map/MapExplorer';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import {
  BUSINESS_CATEGORIES,
  DEFAULT_MAP_CITY,
  MAP_CITIES,
  mapCityOf,
  stayCityForSlug,
} from '@/lib/businesses';
import { STAY_TYPE_OPTIONS } from '@/lib/stays';
import type { Business, Stay } from '@/lib/types';

export const metadata: Metadata = {
  title: '한인업체·숙소 지도',
  description:
    '캐나다 한인 식당, 마트, 미용실, 병원과 룸렌트·홈스테이·하숙을 지도에서 한 번에 찾아보세요.',
};

type Props = {
  searchParams: Promise<{
    mode?: string;
    city?: string;
    category?: string;
    type?: string;
    near?: string;
  }>;
};

/** How many rows and markers the panel will render; see the note below. */
const MAX_RESULTS = 120;

/** `near` is only passed through when it parses as lng,lat. */
function safeNear(value: string | undefined): string | null {
  if (!value) return null;
  const [lng, lat] = value.split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `${lng},${lat}`;
}

export default async function MapPage({ searchParams }: Props) {
  const sp = await searchParams;

  const mode: MapMode = sp.mode === 'stay' ? 'stay' : 'biz';
  const citySlug = MAP_CITIES.some((c) => c.key === sp.city) ? sp.city! : DEFAULT_MAP_CITY;
  const category = BUSINESS_CATEGORIES.some((c) => c.key === sp.category) ? sp.category! : '';
  const stayType = STAY_TYPE_OPTIONS.some((t) => t.key === sp.type) ? sp.type! : '';
  const user = await getCurrentUser();

  // Always ask for results nearest a point, defaulting to the city centre.
  // Toronto alone has 534 approved businesses, and both the list rows and the
  // map markers are real DOM — rendering every one of them janks the panel. The
  // API already sorts by distance when `near` is given, so taking the closest
  // MAX_RESULTS is both faster and what someone looking at a map wants.
  const city = mapCityOf(citySlug);
  const near = safeNear(sp.near) ?? `${city.lng},${city.lat}`;

  // Businesses key off a lowercase slug ('toronto'); stays key off the
  // capitalised English name ('Toronto'). Sending one where the other belongs
  // matches nothing and looks like an empty city.
  const bizQuery = new URLSearchParams({ city: citySlug, near });
  if (category) bizQuery.set('category', category);

  const stayCity = stayCityForSlug(citySlug);
  const stayQuery = new URLSearchParams({ near });
  if (stayCity) stayQuery.set('city', stayCity);
  if (stayType) stayQuery.set('type', stayType);

  // Only the active mode's list is fetched; the other panel is not rendered.
  const [businesses, stays] = await Promise.all([
    mode === 'biz'
      ? apiFetchOrNull<Business[]>(`/businesses?${bizQuery}`, { revalidate: 300 })
      : Promise.resolve(null),
    mode === 'stay'
      ? apiFetchOrNull<Stay[]>(`/stays?${stayQuery}`, { revalidate: 60 })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <SiteHeader user={user} active="map" />
      <div className="border-t border-line">
        <MapExplorer
          mode={mode}
          citySlug={citySlug}
          category={category}
          stayType={stayType}
          businesses={(businesses ?? []).slice(0, MAX_RESULTS)}
          stays={(stays ?? []).slice(0, MAX_RESULTS)}
          totalCount={(mode === 'biz' ? businesses : stays)?.length ?? 0}
        />
      </div>
    </>
  );
}
