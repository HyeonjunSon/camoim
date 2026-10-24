'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IntroRequest } from '@/lib/types';
import { ageFromBirthYear, genderLabel, jobLabel } from '@/lib/intro';
import { timeAgo } from '@/lib/format';
import { useLang, useMessages } from '@/lib/i18n/client';

const BADGES: Record<string, { key: 'badgeSchool' | 'badgeEmail'; bg: string; fg: string }> = {
  school: { key: 'badgeSchool', bg: '#DBEAFE', fg: '#1D4ED8' },
  email: { key: 'badgeEmail', bg: '#D1FAE5', fg: '#047857' },
};

/**
 * Requests received on my intro posts. Accepting opens an anonymous chat room
 * and returns its id; declining is deliberately silent — the API never tells the
 * sender, so neither does this.
 */
export default function IntroRequestInbox({ requests }: { requests: IntroRequest[] }) {
  const router = useRouter();
  const [items, setItems] = useState(requests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.intro;
  const lang = useLang();

  async function accept(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/intro/requests/${id}/accept`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.acceptFailed);
      router.refresh();
      router.push(`/chat/${json.data.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.acceptFailed);
      setBusy(null);
    }
  }

  async function decline(id: string) {
    if (!window.confirm(m.declineConfirm)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/intro/requests/${id}/decline`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.declineFailed);
      setItems((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.declineFailed);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
        {m.noRequests}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((req) => {
          const badge = BADGES[req.verificationBadge];
          const working = busy === req.id;
          return (
            <li key={req.id} className="rounded-card border border-line-soft bg-surface px-5 py-4">
              <p className="text-[12.5px] text-muted">
                {req.introHeadline ? m.requestFor(req.introHeadline) : m.requestForMine}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-bold">
                  {[genderLabel(req.gender, lang), ageFromBirthYear(req.birthYear, undefined, lang)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {req.region ? <span className="text-[13.5px] text-ink-3">{req.region}</span> : null}
                {req.job ? <span className="text-[13.5px] text-ink-3">{jobLabel(req.job, lang)}</span> : null}
                {badge ? (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11.5px] font-bold"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    {m[badge.key]}
                  </span>
                ) : null}
                {req.memberMonths > 0 ? (
                  <span className="text-[12px] text-muted">{m.memberFor(req.memberMonths)}</span>
                ) : null}
                <span className="ml-auto text-[12px] text-muted">{timeAgo(req.createdAt, undefined, lang)}</span>
              </div>

              <p className="mt-2.5 rounded-[10px] bg-field px-3.5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
                {req.message}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => accept(req.id)}
                  disabled={working}
                  className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
                >
                  {working ? all.group.processing : m.acceptOpen}
                </button>
                <button
                  type="button"
                  onClick={() => decline(req.id)}
                  disabled={working}
                  className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                >
                  {m.decline}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
