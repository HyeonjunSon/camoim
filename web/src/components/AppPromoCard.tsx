import { getI18n } from '@/lib/i18n/server';

const APP_STORE = 'https://apps.apple.com/ca/app/camoim/id6763469709';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.hyeonjun122.cahanin';

export default async function AppPromoCard() {
  const { m } = await getI18n();
  return (
    <section className="rounded-card bg-brand-deep p-5 text-white">
      <h2 className="text-base font-bold">{m.home.appTitle}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#D9D7F5]">
        {m.home.appBody}
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <a
          href={APP_STORE}
          className="flex h-10 items-center rounded-[10px] bg-white px-3.5 text-[13.5px] font-semibold text-ink"
        >
          App Store
        </a>
        <a
          href={PLAY_STORE}
          className="flex h-10 items-center rounded-[10px] bg-white px-3.5 text-[13.5px] font-semibold text-ink"
        >
          Google Play
        </a>
      </div>
    </section>
  );
}
