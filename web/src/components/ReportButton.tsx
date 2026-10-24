'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { REPORT_REASONS, type ReportReason } from '@/lib/types';
import { useMessages } from '@/lib/i18n/client';

/**
 * Reporting is required for user-generated content (Apple guideline 1.2), and
 * the API auto-hides a target once three reports land on it.
 */
export default function ReportButton({
  targetType,
  targetId,
  postId,
  label,
  className,
  signedIn,
}: {
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  /** Lets an admin jump to the post a reported comment sits on. */
  postId?: string;
  label?: string;
  className?: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const all = useMessages();
  const m = all.report;

  function start() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bff/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, postId, reason, detail: detail.trim() }),
      });
      const json = await res.json();
      // 409 means this target was already reported by this account; the API's
      // message says so, so it is shown as-is rather than as a failure.
      if (!res.ok || !json.success) throw new Error(json.message || m.failed);
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setDetail('');
        router.refresh();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-haspopup="dialog"
        className={className ?? 'text-[13px] text-muted hover:text-danger'}
      >
        {label ?? m.button}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={all.common.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[420px] rounded-card bg-surface px-5 py-5 shadow-xl sm:px-6">
            <h2 id={`${dialogId}-title`} className="text-lg font-bold">
              {m.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-muted">
              {m.intro}
            </p>

            {done ? (
              <p role="status" className="mt-5 rounded-[10px] bg-[#E8FFF1] px-3.5 py-3 text-sm text-[#0F7A4F]">
                {m.done}
              </p>
            ) : (
              <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
                <fieldset>
                  <legend className="text-[13.5px] font-semibold text-ink-3">{m.reason}</legend>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {REPORT_REASONS.map((r) => (
                      <label key={r.value} className="flex items-center gap-2.5 text-[15px]">
                        <input
                          type="radio"
                          name={`${dialogId}-reason`}
                          value={r.value}
                          checked={reason === r.value}
                          onChange={() => setReason(r.value)}
                          className="size-4.5 accent-brand-strong"
                        />
                        {m.reasons[r.value] ?? r.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor={`${dialogId}-detail`} className="block text-[13.5px] font-semibold text-ink-3">
                    {m.detail}
                  </label>
                  <textarea
                    id={`${dialogId}-detail`}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="mt-1.5 w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
                  />
                </div>

                {error ? (
                  <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
                    {error}
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-11 flex-1 rounded-control bg-danger text-[15px] font-semibold text-white disabled:opacity-55"
                  >
                    {busy ? m.sending : m.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-11 rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
                  >
                    {all.common.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
