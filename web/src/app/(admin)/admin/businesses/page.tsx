import type { Metadata } from 'next';
import Link from 'next/link';
import BusinessApprovalQueue from '@/components/admin/BusinessApprovalQueue';
import { apiFetchEnvelope } from '@/lib/api';
import type { AdminBusinessEnvelope } from '@/lib/types';

export const metadata: Metadata = {
  title: '업체 승인',
  robots: { index: false, follow: false },
};

const TABS = [
  { key: 'pending', label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
] as const;

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminBusinessesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : 'pending';

  // The per-status counts sit beside `data`, so the whole envelope is needed.
  const envelope = await apiFetchEnvelope<AdminBusinessEnvelope>(
    `/admin/businesses?status=${status}`
  ).catch(() => null);

  const businesses = envelope?.data ?? [];
  const counts = envelope?.counts;

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">업체 승인</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        회원 제보는 승인 전까지 지도에 올라가지 않아요. 좌표가 없는 업체는 승인해도 핀이 안 보여요.
      </p>

      <nav aria-label="업체 상태" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === status;
          const count = counts?.[t.key];
          return (
            <Link
              key={t.key}
              href={t.key === 'pending' ? '/admin/businesses' : `/admin/businesses?status=${t.key}`}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {t.label}
              {count !== undefined ? ` ${count}` : ''}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <BusinessApprovalQueue businesses={businesses} status={status} />
      </div>
    </main>
  );
}
