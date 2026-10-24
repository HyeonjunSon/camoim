'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { FEED_VIEW_COOKIE, type FeedView } from '@/lib/feedView';

/**
 * 카드형 / 목록형. The choice is a cookie rather than a query parameter so it
 * sticks across boards and visits, and the server renders the chosen view on
 * the first byte — no flash of the other layout.
 */
export default function FeedViewToggle({ view }: { view: FeedView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: FeedView) {
    if (next === view) return;
    document.cookie = `${FEED_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const option = (value: FeedView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => choose(value)}
      aria-pressed={view === value}
      title={label}
      className={`flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold transition-colors ${
        view === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-3'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="보기 방식"
      data-pending={pending ? '' : undefined}
      className="flex rounded-lg bg-field p-0.5 data-pending:opacity-60"
    >
      {option(
        'card',
        '카드',
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="14" width="18" height="7" rx="1.5" />
        </svg>
      )}
      {option(
        'list',
        '목록',
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </div>
  );
}
