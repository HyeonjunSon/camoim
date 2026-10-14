import Link from 'next/link';
import type { Business } from '@/lib/types';
import { categoryOf } from '@/lib/businesses';
import { FlameIcon } from './icons';

/**
 * The weekly top five Korean businesses by views, mirroring the app's
 * TrendingPlaces section on its home screen.
 *
 * The app renders it as a horizontal card scroller; on a wide layout a ranked
 * list in the rail reads better and matches the stays card beside it. Hidden
 * entirely when the week has no views yet, as the app hides it.
 */
export default function TrendingPlacesCard({ places }: { places: Business[] }) {
  if (places.length === 0) return null;

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-4.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
          <FlameIcon size={16} className="text-[#EF4444]" />
          이번 주 인기 장소
        </h2>
        <Link href="/map" className="text-[13.5px] text-brand-ink hover:text-brand-ink-hover">
          지도 ›
        </Link>
      </div>

      <ol className="mt-1">
        {places.map((place, i) => {
          const category = categoryOf(place.category);
          return (
            <li key={place.id}>
              <Link
                href={`/businesses/${place.id}`}
                prefetch={false}
                className="flex items-center gap-2.5 border-t border-line-faint py-2.5 text-ink hover:bg-brand-tint-soft"
              >
                <span
                  aria-hidden
                  className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold ${
                    i < 3 ? 'bg-[#FF6B4A] text-white' : 'bg-field text-ink-3'
                  }`}
                >
                  {place.rank ?? i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{place.name}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    {place.ratingCount > 0
                      ? `★ ${place.ratingAvg.toFixed(1)} (${place.ratingCount})`
                      : category.label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
