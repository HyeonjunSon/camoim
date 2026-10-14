'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Businesses, stays and intro posts each expose `POST /<kind>/:id/report` with
 * their own small reason set, separate from the content report in ReportButton.
 * Keeping them apart avoids sending a reason the API would silently remap.
 */
export default function SimpleReportButton({
  kind,
  id,
  reasons,
  signedIn,
}: {
  kind: 'businesses' | 'stays' | 'intro';
  id: string;
  reasons: readonly { value: string; label: string }[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(reason: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bff/${kind}/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      setMessage(
        !res.ok || !json.success
          ? (json.message || '신고하지 못했어요.')
          : '알려주셔서 고마워요. 확인 후 반영할게요.'
      );
      if (res.ok && json.success) setTimeout(() => setOpen(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!signedIn) {
            router.push(`/login?next=${encodeURIComponent(`/${kind}/${id}`)}`);
            return;
          }
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex h-11 items-center rounded-control px-3 text-sm text-muted hover:bg-field hover:text-danger"
      >
        정보 신고
      </button>

      {open ? (
        <>
          <button type="button" tabIndex={-1} aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-control border border-line-soft bg-surface shadow-lg">
            {message ? (
              <p role="status" className="px-4 py-3 text-[13.5px] text-ink-3">
                {message}
              </p>
            ) : (
              reasons.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => send(r.value)}
                  disabled={busy}
                  className="block w-full px-4 py-3 text-left text-sm text-ink-2 hover:bg-brand-tint-soft disabled:opacity-55"
                >
                  {r.label}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
