import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Notice } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const notice = await apiFetchOrNull<Notice>(`/notices/${id}`, { revalidate: 300 });
  if (!notice) return { title: '공지사항' };
  return {
    title: notice.title,
    description: notice.content?.replace(/\s+/g, ' ').trim().slice(0, 150),
  };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { id } = await params;

  let notice: Notice;
  try {
    notice = await apiFetch<Notice>(`/notices/${id}`, { revalidate: 300 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
      <nav aria-label="경로" className="mb-4 flex gap-2 text-[13.5px] text-muted">
        <Link href="/notices" className="hover:text-ink-3">
          공지사항
        </Link>
      </nav>

      <article className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
        {notice.pinned ? (
          <span className="rounded-md bg-brand-strong px-2 py-1 text-xs font-bold text-white">
            고정 공지
          </span>
        ) : null}
        <h1 className="mt-3 text-[26px] leading-[1.35] font-bold -tracking-[0.5px]">
          {notice.title}
        </h1>
        <p className="mt-2 border-b border-line-faint pb-5 text-[13px] text-muted">
          {[notice.author, timeAgo(notice.createdAt)].filter(Boolean).join(' · ')}
        </p>

        {/* Notice bodies are plain text, so React escapes them; no sanitiser needed. */}
        <div className="mt-5 text-[16px] leading-[1.75] whitespace-pre-wrap text-ink-2">
          {notice.content}
        </div>
      </article>

      <Link
        href="/notices"
        className="mt-5 flex h-11 w-full items-center justify-center rounded-control border border-line-strong text-[15px] font-semibold text-ink-3 hover:bg-field sm:w-auto sm:px-5"
      >
        공지 목록
      </Link>
    </main>
  );
}
