import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import MyIntroList from '@/components/intro/MyIntroList';
import IntroRequestInbox from '@/components/intro/IntroRequestInbox';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { IntroMeta, IntroPost, IntroRequest } from '@/lib/types';

export const metadata: Metadata = {
  title: '내 소개·받은 신청',
  robots: { index: false, follow: false },
};

export default async function MyIntroPage() {
  const user = await getCurrentUser();
  const meta = await apiFetchOrNull<IntroMeta>('/intro/meta');
  if (!meta?.agreed) notFound();

  const [mine, requests] = await Promise.all([
    apiFetchOrNull<IntroPost[]>('/intro/mine'),
    apiFetchOrNull<IntroRequest[]>('/intro/requests/received'),
  ]);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/intro" className="hover:text-ink-3">
            소개팅
          </Link>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold -tracking-[0.4px]">내 소개·받은 신청</h1>
          <Link
            href="/intro/new"
            className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
          >
            소개 올리기
          </Link>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-bold">받은 신청 {requests?.length ?? 0}</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            수락하면 익명 채팅이 열려요. 거절은 상대에게 알려지지 않아요.
          </p>
          <div className="mt-3">
            <IntroRequestInbox requests={requests ?? []} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">올린 소개 {mine?.length ?? 0}</h2>
          <div className="mt-3">
            <MyIntroList posts={mine ?? []} />
          </div>
        </section>
      </main>
    </>
  );
}
