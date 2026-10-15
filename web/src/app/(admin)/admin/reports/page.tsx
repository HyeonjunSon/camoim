import type { Metadata } from 'next';
import Link from 'next/link';
import ReportQueue from '@/components/admin/ReportQueue';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminReport } from '@/lib/types';

export const metadata: Metadata = {
  title: '신고 처리',
  robots: { index: false, follow: false },
};

const TABS = [
  { key: 'pending', label: '대기' },
  { key: 'resolved', label: '인정' },
  { key: 'dismissed', label: '기각' },
] as const;

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : 'pending';

  const reports = (await apiFetchOrNull<AdminReport[]>(`/admin/reports?status=${status}`)) ?? [];

  return (
    <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">신고 처리</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        신고가 3건 쌓인 글·댓글은 서버가 이미 자동으로 숨긴 상태예요.
      </p>

      <nav aria-label="신고 상태" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === status;
          return (
            <Link
              key={t.key}
              href={t.key === 'pending' ? '/admin/reports' : `/admin/reports?status=${t.key}`}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {t.label}
              {on ? ` ${reports.length}` : ''}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <ReportQueue reports={reports} status={status} />
      </div>
    </main>
  );
}
