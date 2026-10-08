import Link from 'next/link';
import Image from 'next/image';
import type { Stay } from '@/lib/types';
import { STAY_TYPE_COLORS, STAY_TYPE_LABELS, stayPrice } from '@/lib/stays';
import { cityLabel } from '@/lib/boards';

export default function StaysCard({ stays, city }: { stays: Stay[]; city: string }) {
  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-4.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{city ? `${cityLabel(city)} 숙소` : '내 주변 숙소'}</h2>
        <Link href="/map?mode=stay" className="text-[13.5px] text-brand-ink hover:text-brand-ink-hover">
          지도 ›
        </Link>
      </div>
      {stays.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">아직 올라온 숙소가 없어요.</p>
      ) : (
        <ul>
          {stays.map((stay) => (
            <li key={stay.id}>
              <Link
                href={`/map?stay=${stay.id}`}
                className="mt-2 flex items-center gap-3 border-t border-line-faint py-2.5 text-ink"
              >
                <span className="relative size-13 shrink-0 overflow-hidden rounded-[10px] bg-shade">
                  {stay.images?.[0] ? (
                    <Image src={stay.images[0]} alt="" fill sizes="52px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-xs font-semibold"
                    style={{ color: STAY_TYPE_COLORS[stay.stayType] }}
                  >
                    {STAY_TYPE_LABELS[stay.stayType] ?? '숙소'}
                  </span>
                  <span className="block truncate text-[14.5px]">{stay.title}</span>
                  <span className="mt-0.5 block text-[13px] font-bold">
                    {stayPrice(stay.price, stay.priceUnit)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
