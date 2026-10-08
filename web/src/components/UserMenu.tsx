'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/types';
import { initial } from '@/lib/format';

export default function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // The server bumped tokenVersion, so every cached page must be refetched.
      router.refresh();
      router.push('/');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${user.nickname} 메뉴`}
        className="flex size-10 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
      >
        {initial(user.nickname)}
      </button>

      {open ? (
        <>
          {/* Click-away target. aria-hidden + no focus, so keyboard users are
              unaffected; Escape is handled by the menu's own blur. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-control border border-line-soft bg-surface shadow-lg"
          >
            <div className="border-b border-line-faint px-4 py-3">
              <div className="text-[15px] font-semibold">{user.nickname}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{user.email}</div>
            </div>
            <Link
              role="menuitem"
              href="/mypage"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-ink-2 hover:bg-brand-tint-soft"
            >
              마이페이지
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={logout}
              disabled={busy}
              className="block w-full px-4 py-3 text-left text-sm text-ink-2 hover:bg-brand-tint-soft disabled:opacity-50"
            >
              {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
