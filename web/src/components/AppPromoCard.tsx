const APP_STORE = 'https://apps.apple.com/ca/app/camoim/id6763469709';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.hyeonjun122.cahanin';

export default function AppPromoCard() {
  return (
    <section className="rounded-card bg-brand-deep p-5 text-white">
      <h2 className="text-base font-bold">앱에서 더 편하게</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#D9D7F5]">
        채팅 알림과 근처 업체 찾기는 앱이 더 빨라요.
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
