'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import MapCanvas, { type MapPin } from './MapCanvas';
import { BUSINESS_CATEGORIES, MAP_CITIES, categoryOf, mapCityOf } from '@/lib/businesses';
import { STAY_TYPE_COLORS, STAY_TYPE_LABELS, STAY_TYPE_OPTIONS, stayPrice } from '@/lib/stays';
import type { Business, Stay } from '@/lib/types';

export type MapMode = 'biz' | 'stay';

type Props = {
  mode: MapMode;
  citySlug: string;
  category: string;
  stayType: string;
  businesses: Business[];
  stays: Stay[];
  /** Before the render cap, so the panel can say when it is showing a subset. */
  totalCount: number;
};

/** One row in the left panel, whichever mode is on. */
type Row = {
  id: string;
  href: string;
  category: string;
  color: string;
  name: string;
  sub: string;
  meta: string;
  image: string | null;
  lat: number | null;
  lng: number | null;
  pinLabel: string;
};

export default function MapExplorer({
  mode,
  citySlug,
  category,
  stayType,
  businesses,
  stays,
  totalCount,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movedCentre, setMovedCentre] = useState<{ lat: number; lng: number } | null>(null);

  const city = mapCityOf(citySlug);
  const biz = mode === 'biz';

  const rows: Row[] = useMemo(() => {
    if (biz) {
      return businesses.map((b) => {
        const cat = categoryOf(b.category);
        return {
          id: b.id,
          href: `/businesses/${b.id}`,
          category: cat.label,
          color: cat.color,
          name: b.name,
          sub: b.address,
          meta: [
            b.ratingCount > 0 ? `★ ${b.ratingAvg.toFixed(1)} · 리뷰 ${b.ratingCount}` : '리뷰 없음',
            b.distanceKm != null ? `${b.distanceKm.toFixed(1)}km` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          image: b.images?.[0] ?? null,
          lat: b.lat,
          lng: b.lng,
          pinLabel: cat.label,
        };
      });
    }
    return stays.map((s) => ({
      id: s.id,
      href: `/stays/${s.id}`,
      category: STAY_TYPE_LABELS[s.stayType] ?? '숙소',
      color: STAY_TYPE_COLORS[s.stayType] ?? '#374151',
      name: s.title,
      sub: [stayPrice(s.price, s.priceUnit), s.moveInDate].filter(Boolean).join(' · '),
      meta: s.neighborhood || '',
      image: s.images?.[0] ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      pinLabel: stayPrice(s.price, s.priceUnit),
    }));
  }, [biz, businesses, stays]);

  const pins: MapPin[] = useMemo(
    () =>
      rows
        .filter((r): r is Row & { lat: number; lng: number } => r.lat != null && r.lng != null)
        .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, label: r.pinLabel, color: r.color })),
    [rows]
  );

  /** Filters are links so the URL stays the source of truth and is shareable. */
  function hrefWith(overrides: Record<string, string>) {
    const query = new URLSearchParams({ mode, city: citySlug, category, type: stayType, ...overrides });
    for (const [k, v] of [...query.entries()]) {
      if (!v || (k === 'mode' && v === 'biz')) query.delete(k);
    }
    const qs = query.toString();
    return qs ? `/map?${qs}` : '/map';
  }

  const chips = biz
    ? [{ key: '', label: '전체' }, ...BUSINESS_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))]
    : [{ key: '', label: '전체' }, ...STAY_TYPE_OPTIONS.map((t) => ({ key: t.key, label: t.label }))];
  const activeChip = biz ? category : stayType;
  const chipParam = biz ? 'category' : 'type';

  return (
    <div className="flex flex-wrap items-stretch">
      {/* Map first on a phone. Stacked the other way round, 120 list rows pushed
          the map so far down it was effectively gone. */}
      <section className="order-2 flex w-full flex-col border-line bg-surface md:order-1 md:max-w-[420px] md:flex-[1_1_380px] md:border-r">
        <div className="px-5 pt-5 pb-3.5">
          <div className="grid grid-cols-2 gap-1 rounded-control bg-field p-1">
            {(
              [
                { id: 'biz', label: '한인업체' },
                { id: 'stay', label: '숙소' },
              ] as const
            ).map((m) => {
              const on = m.id === mode;
              return (
                <Link
                  key={m.id}
                  href={hrefWith({ mode: m.id, category: '', type: '' })}
                  aria-current={on ? 'true' : undefined}
                  className={`flex h-10 items-center justify-center rounded-[9px] text-[14.5px] font-bold ${
                    on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-3'
                  }`}
                >
                  {m.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-3.5 flex gap-2 overflow-x-auto pb-0.5">
            {chips.map((chip) => {
              const on = chip.key === activeChip;
              return (
                <Link
                  key={chip.key || 'all'}
                  href={hrefWith({ [chipParam]: chip.key })}
                  aria-current={on ? 'true' : undefined}
                  className={`flex h-9 shrink-0 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold whitespace-nowrap ${
                    on
                      ? 'border-ink bg-ink text-white'
                      : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                  }`}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-3.5 flex gap-2 overflow-x-auto pb-0.5">
            {MAP_CITIES.map((c) => {
              const on = c.key === citySlug;
              return (
                <Link
                  key={c.key}
                  href={hrefWith({ city: c.key })}
                  aria-current={on ? 'true' : undefined}
                  className={`flex h-8 shrink-0 items-center rounded-pill px-3 text-[13px] whitespace-nowrap ${
                    on ? 'bg-brand-tint font-bold text-brand-ink-hover' : 'text-muted hover:bg-field'
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>

          <p className="mt-3.5 text-[13px] text-muted">
            {city.label}에 <strong className="text-ink">{totalCount}곳</strong>
            {totalCount > rows.length ? (
              <span className="ml-1">· 가까운 {rows.length}곳만 보여줘요</span>
            ) : pins.length < rows.length ? (
              <span className="ml-1">· 지도에 {pins.length}곳</span>
            ) : null}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="border-t border-line-faint px-5 py-10 text-sm text-muted">
            {biz ? '이 조건에 맞는 업체가 없어요.' : '이 조건에 맞는 숙소가 없어요.'}
          </p>
        ) : (
          <ul className="border-t border-line-faint md:min-h-0 md:flex-1 md:overflow-y-auto">
            {rows.map((row) => {
              const on = row.id === selectedId;
              return (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    prefetch={false}
                    onMouseEnter={() => setSelectedId(row.id)}
                    onFocus={() => setSelectedId(row.id)}
                    className={`flex gap-3.5 border-b border-line-faint px-5 py-4 text-ink ${
                      on ? 'bg-brand-tint-soft' : 'hover:bg-field'
                    }`}
                  >
                    <span className="relative size-18 shrink-0 overflow-hidden rounded-xl bg-shade">
                      {row.image ? (
                        <Image src={row.image} alt="" fill sizes="72px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold" style={{ color: row.color }}>
                        {row.category}
                      </span>
                      <span className="mt-0.5 block truncate text-[15.5px] font-semibold">
                        {row.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-3">{row.sub}</span>
                      {row.meta ? (
                        <span className="mt-1 block truncate text-[12.5px] text-muted">{row.meta}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line-faint px-5 py-3.5">
          <Link
            href={biz ? '/businesses/new' : '/stays/new'}
            className="flex h-11 items-center justify-center rounded-control border border-[#D8D6F4] text-[14.5px] font-semibold text-brand-ink-hover hover:bg-brand-tint-soft"
          >
            {biz ? '업체 등록·정보 수정 요청' : '내 방 올리기'}
          </Link>
        </div>
      </section>

      <section
        aria-label="지도"
        className="relative order-1 h-[46vh] w-full md:order-2 md:h-auto md:min-h-[520px] md:flex-[999_1_560px]"
      >
        <MapCanvas
          centre={{ lat: city.lat, lng: city.lng }}
          pins={pins}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCentreChange={(lat, lng) => setMovedCentre({ lat, lng })}
        />

        {movedCentre ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                // Refetch sorted by distance from where the map now sits. The
                // API takes `near` as lng,lat — that order, not lat,lng.
                router.push(
                  hrefWith({ near: `${movedCentre.lng.toFixed(5)},${movedCentre.lat.toFixed(5)}` })
                );
                setMovedCentre(null);
              }}
              className="pointer-events-auto h-10 rounded-pill bg-surface px-4 text-sm font-semibold text-brand-ink-hover shadow-lg"
            >
              이 지역에서 다시 검색
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
