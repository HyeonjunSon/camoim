import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetchOrNull } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Notice } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '공지사항',
  description: '캐모임 운영 공지와 업데이트 안내.',
};

export default async function NoticesPage() {
  // Already sorted pinned-first, then newest, by the API.
  const [noticeList, { lang, m: all }] = await Promise.all([
    apiFetchOrNull<Notice[]>('/notices', { revalidate: 300 }),
    getI18n(),
  ]);
  const notices = noticeList ?? [];
  const m = all.notice;

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.title}</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">{m.intro}</p>

      {notices.length === 0 ? (
        <p className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
          {m.empty}
        </p>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-card border border-line-soft bg-surface">
          {notices.map((notice) => (
            <li key={notice.id} className="border-b border-line-faint last:border-b-0">
              <Link
                href={`/notices/${notice.id}`}
                className="block px-5 py-4 text-ink hover:bg-brand-tint-soft"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {notice.pinned ? (
                    <span className="rounded-md bg-brand-strong px-1.5 py-0.5 text-[11.5px] font-bold text-white">
                      {all.common.pinned}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">
                    {notice.title}
                  </span>
                </span>
                {notice.content ? (
                  <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-ink-3">
                    {notice.content}
                  </span>
                ) : null}
                <span className="mt-1.5 block text-[12.5px] text-muted">
                  {timeAgo(notice.createdAt, undefined, lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
