'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminUser, SanctionType } from '@/lib/types';

const ROLES: { value: string; label: string }[] = [
  { value: 'general', label: '일반' },
  { value: 'student', label: '학생' },
  { value: 'working_holiday', label: '워홀' },
  { value: 'admin', label: '운영자' },
];

const SUSPEND_DAYS = [1, 3, 7, 30];

/**
 * Sanctions are hard to walk back, so each one states its effect and asks
 * before it runs. A reason is required for everything except lifting one: the
 * API stores it on the account and the member is shown it when they are turned
 * away.
 */
export default function UserSanctionMenu({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = user.status ?? 'active';
  const sanctioned = status === 'suspended' || status === 'banned';

  async function sanction(type: SanctionType, days = 0) {
    const needsReason = type !== 'unban' && type !== 'unshadow';
    if (needsReason && !reason.trim()) {
      setError('사유를 적어주세요. 회원에게 표시돼요.');
      return;
    }

    const label =
      type === 'warn'
        ? '경고를 보낼까요?'
        : type === 'suspend'
          ? `${days}일 정지할까요? 그동안 로그인은 되지만 글·댓글·채팅이 막혀요.`
          : type === 'ban'
            ? '영구 차단할까요? 바로 로그아웃되고 다시 들어올 수 없어요.'
            : type === 'unban'
              ? '제재를 해제할까요?'
              : type === 'shadow'
                ? '쉐도우 차단할까요? 본인은 모른 채 다른 사람에게만 글이 안 보여요.'
                : '쉐도우 차단을 해제할까요?';
    if (!window.confirm(`${user.nickname}님 — ${label}`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/users/${user.id}/sanction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, days, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      setOpen(false);
      setReason('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(role: string) {
    if (role === user.role) return;
    const warning =
      role === 'admin'
        ? `${user.nickname}님에게 운영자 권한을 줄까요? 모든 회원과 콘텐츠를 다룰 수 있게 돼요.`
        : `${user.nickname}님의 역할을 바꿀까요?`;
    if (!window.confirm(warning)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  const action =
    'h-9 rounded-control border border-line-strong px-2.5 text-[13px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55';

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <label htmlFor={`role-${user.id}`} className="sr-only-label">
          역할
        </label>
        <select
          id={`role-${user.id}`}
          value={user.role}
          onChange={(e) => changeRole(e.target.value)}
          disabled={busy}
          className="h-9 rounded-control border border-line-strong bg-surface px-2 text-[13px] font-semibold text-ink-3 disabled:opacity-55"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => setOpen((v) => !v)} className={action}>
          제재 {open ? '닫기' : ''}
        </button>
      </div>

      {open ? (
        <div className="w-full max-w-[420px] rounded-control border border-line-strong bg-surface p-3">
          <label htmlFor={`reason-${user.id}`} className="sr-only-label">
            제재 사유
          </label>
          <input
            id={`reason-${user.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유 (해제 외에는 필수) — 회원에게 표시돼요"
            className="h-10 w-full rounded-control border border-line-strong px-3 text-[13.5px] outline-none focus:border-brand-strong"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => sanction('warn')} disabled={busy} className={action}>
              경고
            </button>
            {SUSPEND_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => sanction('suspend', d)}
                disabled={busy}
                className={action}
              >
                {d}일 정지
              </button>
            ))}
            <button
              type="button"
              onClick={() => sanction('ban')}
              disabled={busy}
              className="h-9 rounded-control bg-danger px-2.5 text-[13px] font-semibold text-white disabled:opacity-55"
            >
              영구 차단
            </button>
            {sanctioned ? (
              <button
                type="button"
                onClick={() => sanction('unban')}
                disabled={busy}
                className="h-9 rounded-control bg-brand-strong px-2.5 text-[13px] font-semibold text-white disabled:opacity-55"
              >
                제재 해제
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => sanction(user.shadowBanned ? 'unshadow' : 'shadow')}
              disabled={busy}
              className={action}
            >
              {user.shadowBanned ? '쉐도우 해제' : '쉐도우 차단'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-right text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
