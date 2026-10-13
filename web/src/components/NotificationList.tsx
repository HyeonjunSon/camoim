'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppNotification, NotificationType } from '@/lib/types';
import { timeAgo } from '@/lib/format';

/** One tone per kind, so a glance tells comment from report. */
const TONES: Record<string, { bg: string; fg: string; label: string }> = {
  comment: { bg: '#E0E7FF', fg: '#4338CA', label: '댓글' },
  reply: { bg: '#E0E7FF', fg: '#4338CA', label: '답글' },
  like: { bg: '#FCE7F3', fg: '#BE185D', label: '좋아요' },
  chat_request: { bg: '#D1FAE5', fg: '#047857', label: '채팅 요청' },
  verify: { bg: '#DBEAFE', fg: '#1D4ED8', label: '학교 인증' },
  report: { bg: '#FEE2E2', fg: '#B91C1C', label: '신고' },
  notice: { bg: '#F1F0FC', fg: '#463FA8', label: '공지' },
  group: { bg: '#FFEDD5', fg: '#C2410C', label: '모임' },
  university_leader: { bg: '#FEF3C7', fg: '#B45309', label: '학생회장' },
  intro: { bg: '#FCE7F3', fg: '#BE185D', label: '소개팅' },
};

function toneFor(type: NotificationType) {
  return TONES[type] ?? { bg: '#F3F4F6', fg: '#374151', label: '알림' };
}

/** Where tapping a notification should land. */
function hrefFor(n: AppNotification): string | null {
  if (n.roomId) return `/chat/${n.roomId}`;
  if (n.postId) return `/posts/${n.postId}`;
  return null;
}

export default function NotificationList({ initial }: { initial: AppNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  const unread = items.filter((n) => !n.isRead).length;

  async function markAllRead() {
    setBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch('/api/bff/notifications/read-all', { method: 'PUT' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function markOneRead(id: string) {
    if (items.find((n) => n.id === id)?.isRead) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    // Fire and forget: the navigation should not wait on it.
    fetch(`/api/bff/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold -tracking-[0.4px]">알림</h1>
          <p className="mt-1.5 text-[14.5px] text-muted">
            {unread > 0 ? `읽지 않은 알림 ${unread}개` : '모두 읽었어요'}
          </p>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy}
            className="h-10 rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
          >
            모두 읽음
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">아직 알림이 없어요.</p>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-card border border-line-soft bg-surface">
          {items.map((n) => {
            const tone = toneFor(n.type);
            const href = hrefFor(n);
            const body = (
              <>
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {tone.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] ${n.isRead ? 'text-ink-3' : 'font-semibold text-ink'}`}>
                    {n.message}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-muted">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead ? (
                  <span aria-label="읽지 않음" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                ) : null}
              </>
            );

            return (
              <li key={n.id} className="border-b border-line-faint last:border-b-0">
                {href ? (
                  <Link
                    href={href}
                    prefetch={false}
                    onClick={() => markOneRead(n.id)}
                    className={`flex items-start gap-3 px-5 py-4 ${n.isRead ? '' : 'bg-brand-tint-soft'} hover:bg-field`}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markOneRead(n.id)}
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left ${n.isRead ? '' : 'bg-brand-tint-soft'} hover:bg-field`}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
