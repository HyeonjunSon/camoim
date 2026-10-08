import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '소개팅',
  // Age-gated and members-only, so it stays out of search results entirely.
  robots: { index: false, follow: false },
};

/**
 * The intro board does not use Post at all — it has its own IntroPost model and
 * its own age gate. Until that lands on the web (step 4), signed-in members get
 * an honest hand-off to the app rather than an empty board feed.
 */
export default async function IntroPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/intro');

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[560px] px-4 pb-20 pt-12 sm:px-6">
        <div className="rounded-card border border-line-soft bg-surface px-6 py-7">
          <span className="rounded-md bg-[#FCE7F3] px-2 py-1 text-xs font-bold text-[#BE185D]">
            만 19세 이상
          </span>
          <h1 className="mt-3.5 text-xl font-bold">소개팅은 아직 앱에서만 열려 있어요</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">
            소개팅 게시판은 나이 확인과 1:1 익명 채팅이 함께 묶여 있어서, 웹 버전은 준비가 끝나는
            대로 열어드릴게요. 그동안은 앱에서 그대로 이용할 수 있어요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="https://apps.apple.com/ca/app/camoim/id6763469709"
              className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.hyeonjun122.cahanin"
              className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
            >
              Google Play
            </a>
            <Link
              href="/boards"
              className="flex h-11 items-center px-2 text-[15px] font-semibold text-brand-ink hover:text-brand-ink-hover"
            >
              다른 게시판 보기
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
