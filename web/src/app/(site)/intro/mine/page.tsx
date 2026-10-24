import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MyIntroList from '@/components/intro/MyIntroList';
import IntroRequestInbox from '@/components/intro/IntroRequestInbox';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { IntroMeta, IntroPost, IntroRequest } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '내 소개·받은 신청',
  robots: { index: false, follow: false },
};

export default async function MyIntroPage() {
  const [user, { m: all }] = await Promise.all([getCurrentUser(), getI18n()]);
  const m = all.intro;
  const meta = await apiFetchOrNull<IntroMeta>('/intro/meta');
  if (!meta?.agreed) notFound();

  const [mine, requests] = await Promise.all([
    apiFetchOrNull<IntroPost[]>('/intro/mine'),
    apiFetchOrNull<IntroRequest[]>('/intro/requests/received'),
  ]);

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label={all.post.breadcrumb} className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/intro" className="hover:text-ink-3">
            {m.title}
          </Link>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.mineTitle}</h1>
          <Link
            href="/intro/new"
            className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
          >
            {m.post}
          </Link>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-bold">{m.received(requests?.length ?? 0)}</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            {m.receivedHint}
          </p>
          <div className="mt-3">
            <IntroRequestInbox requests={requests ?? []} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{m.posted(mine?.length ?? 0)}</h2>
          <div className="mt-3">
            <MyIntroList posts={mine ?? []} />
          </div>
        </section>
      </main>
    </>
  );
}
