import { getI18n } from '@/lib/i18n/server';

// Today's visitors badge — the same signal the app's home header shows
// (src/components/TodayVisitors.js), with the same display-only boost.

// Keep in step with HOME_BADGE_BOOST in the app. Admins read the raw DAU on
// the dashboard, so only this public badge carries it.
const HOME_BADGE_BOOST = 30;

export default async function TodayVisitors({ count }: { count: number | null }) {
  // Hidden when the request failed, as in the app — a secondary metric.
  if (count == null) return null;
  const { m } = await getI18n();
  return (
    <section className="flex items-center gap-2.5 rounded-card border border-line-soft bg-surface px-5 py-3.5">
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#34C759] opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-[#34C759]" />
      </span>
      <p className="text-[14px] font-semibold text-ink-3">
        {m.home.visitorsPre}
        <span className="text-[17px] font-extrabold text-brand-ink tabular-nums">
          {count + HOME_BADGE_BOOST}
        </span>
        {m.home.visitorsPost}
      </p>
    </section>
  );
}
