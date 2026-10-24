'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMessages } from '@/lib/i18n/client';

/**
 * The school lounge is created on first entry: GET /universities/chat lazily
 * makes the room and joins the caller. So this has to be a request rather than
 * a plain link — there may be no room id to link to yet.
 */
export default function SchoolChatLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bff/universities/chat');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.post.chatFailed);
      const roomId = json.data?.id ?? json.data?.roomId;
      if (!roomId) throw new Error(all.post.chatFailed);
      router.push(`/chat/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.post.chatFailed);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-strong text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55 sm:w-auto sm:px-5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
        {busy ? `${all.common.opening}…` : all.school.openChat}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
