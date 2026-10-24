'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMessages } from '@/lib/i18n/client';

/** The host's own switch between 입주가능 and 입주완료 (`PUT /stays/:id/status`). */
export default function StayStatusToggle({
  stayId,
  status,
}: {
  stayId: string;
  status: 'active' | 'closed';
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const m = useMessages().stay;

  async function toggle() {
    const next = current === 'active' ? 'closed' : 'active';
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/stays/${stayId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return;
      setCurrent(next);
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
      className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-2 hover:bg-field disabled:opacity-55"
    >
      {current === 'active' ? m.markFilled : m.markAvailable}
    </button>
  );
}
