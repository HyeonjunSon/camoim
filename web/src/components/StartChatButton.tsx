'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMessages } from '@/lib/i18n/client';

/**
 * Opens (or reuses) the DM room with this person and goes there. A first DM
 * starts as a request: the API lets the opener send one message, and the other
 * side has to accept before the conversation continues.
 */
export default function StartChatButton({
  targetUserId,
  signedIn,
  label,
  className,
}: {
  targetUserId: string;
  signedIn: boolean;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useMessages();

  async function start() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bff/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const json = await res.json();
      // A block in either direction comes back as 403 with its own message.
      if (!res.ok || !json.success) throw new Error(json.message || m.post.chatFailed);
      router.push(`/chat/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.post.chatFailed);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          className ??
          'flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand-strong text-base font-bold text-white hover:bg-brand-ink-hover disabled:opacity-55'
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
        {busy ? `${m.common.opening}…` : (label ?? m.post.startChat)}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
