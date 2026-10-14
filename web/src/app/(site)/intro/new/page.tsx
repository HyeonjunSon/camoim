import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import IntroForm from '@/components/intro/IntroForm';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { IntroMeta } from '@/lib/types';

export const metadata: Metadata = {
  title: '소개 올리기',
  robots: { index: false, follow: false },
};

export default async function NewIntroPage() {
  const user = await getCurrentUser();
  const meta = await apiFetchOrNull<IntroMeta>('/intro/meta');
  // The API refuses to create a post without the agreement, so send them to the
  // gate rather than render a form it would reject.
  if (!meta?.agreed) notFound();

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/intro" className="hover:text-ink-3">
            소개팅
          </Link>
        </nav>
        <h1 className="text-2xl font-bold -tracking-[0.4px]">소개 올리기</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          실명, 회사명, 연락처는 본문에 적지 말아주세요.
        </p>
        <div className="mt-6">
          <IntroForm meta={meta} />
        </div>
      </main>
    </>
  );
}
