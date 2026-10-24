'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BlockStatus } from '@/lib/types';
import { useMessages } from '@/lib/i18n/client';

/**
 * Blocking covers two things the API tracks separately: hiding the person's
 * posts and comments, and refusing chat with them. The app's toggle sets both,
 * and so does this one, so the two clients mean the same thing by "blocked".
 */
export default function BlockButton({
  userId,
  nickname,
  initialStatus,
}: {
  userId: string;
  nickname: string;
  initialStatus: BlockStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useMessages();

  async function toggle() {
    const blocking = !status.blocked;
    if (blocking && !window.confirm(m.post.blockConfirm(nickname))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/users/${userId}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Both false is how the API lifts a block.
        body: JSON.stringify({ blockChat: blocking, hideContent: blocking }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.common.failed);
      setStatus(json.data as BlockStatus);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={status.blocked}
        className={`flex h-11 items-center rounded-control border px-4 text-[14.5px] font-semibold disabled:opacity-55 ${
          status.blocked
            ? 'border-line-strong bg-field text-ink-3'
            : 'border-line-strong bg-surface text-ink-2 hover:bg-field'
        }`}
      >
        {status.blocked ? m.post.unblock : m.post.block}
      </button>
      {error ? (
        <span role="alert" className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
