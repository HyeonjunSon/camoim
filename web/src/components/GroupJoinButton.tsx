'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GroupDetail } from '@/lib/types';

/**
 * One button for the whole membership lifecycle. The API decides what joining
 * means — an open group activates immediately, an approval group leaves the
 * membership `pending`, and a school club refuses anyone who is not a verified
 * member of that school, with its own message.
 */
export default function GroupJoinButton({
  group,
  signedIn,
}: {
  group: GroupDetail;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membership = group.myMembership;
  const isOwner = membership?.role === 'owner';
  const active = membership?.status === 'active';
  const pending = membership?.status === 'pending';
  const banned = membership?.status === 'banned';

  async function call(path: string, method: 'POST' | 'DELETE') {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/groups/${group.id}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff${path}`, { method });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm('이 모임에서 나갈까요?')) return;
    call(`/groups/${group.id}/leave`, 'DELETE');
  }

  if (banned) {
    return (
      <p className="rounded-control bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
        이 모임에서 차단된 상태예요.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOwner ? (
        <span className="flex h-11 items-center rounded-control bg-brand-tint px-4 text-[14.5px] font-semibold text-brand-ink-hover">
          내가 만든 모임
        </span>
      ) : active ? (
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
        >
          모임 나가기
        </button>
      ) : pending ? (
        <>
          <span className="flex h-11 items-center rounded-control bg-[#FEF3C7] px-4 text-[14.5px] font-semibold text-[#B45309]">
            승인 대기 중
          </span>
          <button
            type="button"
            onClick={() => call(`/groups/${group.id}/leave`, 'DELETE')}
            disabled={busy}
            className="h-11 rounded-control px-3 text-sm text-muted hover:bg-field disabled:opacity-55"
          >
            신청 취소
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => call(`/groups/${group.id}/join`, 'POST')}
          disabled={busy}
          className="flex h-11 items-center rounded-control bg-brand-strong px-5 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? '처리 중…' : group.joinPolicy === 'approval' ? '가입 신청' : '가입하기'}
        </button>
      )}

      {error ? (
        <span role="alert" className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
