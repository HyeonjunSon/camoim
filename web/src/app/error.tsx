'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Shown when a page's own data fetch fails. Pages that need the board list or a
 * post deliberately throw rather than rendering something misleading — an
 * outage reading as "no such board" would be worse than saying it plainly.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-[480px] flex-col items-center px-6 py-24 text-center">
      <p className="text-5xl font-bold text-brand">!</p>
      <h1 className="mt-4 text-xl font-bold">잠시 문제가 생겼어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center rounded-control bg-brand-strong px-5 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="flex h-11 items-center rounded-control border border-line-strong px-5 text-[15px] font-semibold text-ink-3 hover:bg-field"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
