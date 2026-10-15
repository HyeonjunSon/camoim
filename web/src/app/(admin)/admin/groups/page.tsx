import type { Metadata } from 'next';
import Link from 'next/link';
import GroupApprovalQueue from '@/components/admin/GroupApprovalQueue';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminGroup } from '@/lib/types';

export const metadata: Metadata = {
  title: '모임 승인',
  robots: { index: false, follow: false },
};

const TABS = [
  { key: 'pending_review', label: '대기' },
  { key: 'active', label: '운영 중' },
  { key: 'rejected', label: '반려' },
] as const;

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminGroupsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : 'pending_review';

  const groups = (await apiFetchOrNull<AdminGroup[]>(`/admin/groups?status=${status}`)) ?? [];

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">모임 승인</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        승인하면 목록에 올라가고 단체 채팅이 열려요. 모임장은 승인 전에도 들어갈 수 있어요.
      </p>

      <nav aria-label="모임 상태" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === status;
          return (
            <Link
              key={t.key}
              href={t.key === 'pending_review' ? '/admin/groups' : `/admin/groups?status=${t.key}`}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {t.label}
              {on ? ` ${groups.length}` : ''}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <GroupApprovalQueue groups={groups} status={status} />
      </div>
    </main>
  );
}
