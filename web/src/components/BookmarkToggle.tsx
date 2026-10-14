'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Shared by the business and stay pages: both expose the same
 * `POST /<kind>/:id/bookmark` toggle and answer with the new state.
 */
export default function BookmarkToggle({
  kind,
  id,
  initialBookmarked,
  initialCount,
  signedIn,
}: {
  kind: 'businesses' | 'stays';
  id: string;
  initialBookmarked: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/${kind}/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/${kind}/${id}/bookmark`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) return;
      setBookmarked(json.data.bookmarked);
      setCount((n) => Math.max(0, n + (json.data.bookmarked ? 1 : -1)));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={bookmarked}
      className={`flex h-11 items-center gap-1.5 rounded-control border px-4 text-[14.5px] font-semibold disabled:opacity-55 ${
        bookmarked
          ? 'border-brand-ink bg-brand-tint text-brand-ink-hover'
          : 'border-line-strong bg-surface text-ink-2 hover:bg-field'
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      {bookmarked ? '저장됨' : '저장'} {count > 0 ? count : ''}
    </button>
  );
}
