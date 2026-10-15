'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminGroup } from '@/lib/types';
import { groupCategoryLabel } from '@/lib/groups';
import { cityLabel } from '@/lib/boards';
import { timeAgo } from '@/lib/format';

export default function GroupApprovalQueue({
  groups,
  status,
}: {
  groups: AdminGroup[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(groups);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !(reasons[id] ?? '').trim()) {
      setError('반려할 때는 사유를 적어주세요. 모임장에게 전달돼요.');
      return;
    }
    if (
      !window.confirm(
        action === 'approve'
          ? '이 모임을 승인할까요? 목록에 올라가고 단체 채팅이 열려요.'
          : '이 모임을 반려할까요?'
      )
    ) {
      return;
    }

    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/groups/${id}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: (reasons[id] ?? '').trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      setItems((prev) => prev.filter((g) => g.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
        {status === 'pending_review' ? '승인 대기 중인 모임이 없어요.' : '해당 상태의 모임이 없어요.'}
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
        {items.map((group) => {
          const working = busy === group.id;
          return (
            <li
              key={group.id}
              className="flex flex-wrap gap-4 rounded-card border border-line-soft bg-surface px-5 py-4"
            >
              <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-shade">
                {group.coverImage ? (
                  <Image src={group.coverImage} alt="" fill sizes="80px" className="object-cover" />
                ) : null}
              </span>

              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                    {groupCategoryLabel(group.category)}
                  </span>
                  {group.university ? (
                    <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                      {group.university} 동아리
                    </span>
                  ) : null}
                  {group.joinPolicy === 'approval' ? (
                    <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11.5px] font-bold text-[#B45309]">
                      승인 가입
                    </span>
                  ) : null}
                  <span className="ml-auto text-[12px] text-muted">{timeAgo(group.createdAt)}</span>
                </div>

                <Link
                  href={`/groups/${group.id}`}
                  target="_blank"
                  prefetch={false}
                  className="mt-1.5 block text-[16px] font-bold text-ink hover:underline"
                >
                  {group.name} ↗
                </Link>

                {group.description ? (
                  <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-3">
                    {group.description}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13.5px] text-muted">소개가 비어 있어요.</p>
                )}

                <p className="mt-2 text-[12.5px] text-muted">
                  {[
                    group.ownerId ? `모임장 ${group.ownerId.nickname}` : '모임장 정보 없음',
                    group.ownerId?.email,
                    cityLabel(group.city) || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                {status === 'pending_review' ? (
                  <>
                    <label htmlFor={`greason-${group.id}`} className="sr-only-label">
                      반려 사유
                    </label>
                    <input
                      id={`greason-${group.id}`}
                      value={reasons[group.id] ?? ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [group.id]: e.target.value }))
                      }
                      placeholder="반려 사유 (반려 시 필수) — 모임장에게 전달돼요"
                      className="mt-3 h-11 w-full rounded-control border border-line-strong px-3.5 text-[14px] outline-none focus:border-brand-strong"
                    />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act(group.id, 'approve')}
                        disabled={working}
                        className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[14.5px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => act(group.id, 'reject')}
                        disabled={working}
                        className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                      >
                        반려
                      </button>
                    </div>
                  </>
                ) : group.rejectReason ? (
                  <p className="mt-3 rounded-[10px] bg-field px-3.5 py-2.5 text-[13.5px] text-ink-3">
                    반려 사유: {group.rejectReason}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
