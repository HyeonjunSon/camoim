'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PostDetail } from '@/lib/types';
import { isTradeBoard, tradeLabel } from '@/lib/boards';
import { useLang, useMessages } from '@/lib/i18n/client';

export default function PostOwnerMenu({ post }: { post: PostDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useMessages();
  const lang = useLang();

  const tradeBoard = isTradeBoard(post.boardSlug);
  const sold = post.tradeStatus === 'sold';

  async function call(path: string, method: 'PUT' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.common.failed);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common.failed);
      return false;
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function toggleTrade() {
    const ok = await call(`/posts/${post.id}/trade-status`, 'PUT', {
      status: sold ? 'selling' : 'sold',
    });
    if (ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm(m.post.deleteConfirm)) return;
    const ok = await call(`/posts/${post.id}`, 'DELETE');
    if (ok) {
      router.refresh();
      router.replace(post.boardSlug ? `/boards/${post.boardSlug}` : '/');
    }
  }

  const item = 'block w-full px-4 py-3 text-left text-sm text-ink-2 hover:bg-brand-tint-soft disabled:opacity-55';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={m.post.manage}
        className="flex size-11 items-center justify-center rounded-[10px] hover:bg-field"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#6E6E73" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-control border border-line-soft bg-surface shadow-lg"
          >
            <a role="menuitem" href={`/posts/${post.id}/edit`} className={item}>
              {m.common.edit}
            </a>
            {tradeBoard ? (
              <button role="menuitem" type="button" onClick={toggleTrade} disabled={busy} className={item}>
                {m.post.changeTo(tradeLabel(post.boardSlug, sold ? 'selling' : 'sold', lang))}
              </button>
            ) : null}
            <button
              role="menuitem"
              type="button"
              onClick={remove}
              disabled={busy}
              className={`${item} text-danger`}
            >
              {m.common.delete}
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="absolute right-0 top-12 z-20 w-56 rounded-[10px] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
