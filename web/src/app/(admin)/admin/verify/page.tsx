import type { Metadata } from 'next';
import Link from 'next/link';
import VerifyQueue from '@/components/admin/VerifyQueue';
import { apiFetchOrNull } from '@/lib/api';
import type { VerifyRequest } from '@/lib/types';

export const metadata: Metadata = {
  title: '학교 인증 검수',
  robots: { index: false, follow: false },
};

const TABS = [
  { key: 'pending', label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
] as const;

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminVerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : 'pending';

  const requests =
    (await apiFetchOrNull<VerifyRequest[]>(`/admin/verify-requests?status=${status}`)) ?? [];

  return (
    <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">학교 인증 검수</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        승인하면 그 학교의 게시판·커뮤니티·전체 채팅이 열려요. 반려 사유는 신청자에게 전달돼요.
      </p>

      <nav aria-label="신청 상태" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === status;
          return (
            <Link
              key={t.key}
              href={t.key === 'pending' ? '/admin/verify' : `/admin/verify?status=${t.key}`}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {t.label}
              {on ? ` ${requests.length}` : ''}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <VerifyQueue requests={requests} status={status} />
      </div>
    </main>
  );
}
