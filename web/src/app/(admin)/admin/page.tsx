import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminStats } from '@/lib/types';

export const metadata: Metadata = {
  title: '운영 대시보드',
  robots: { index: false, follow: false },
};

function Tile({
  label,
  value,
  hint,
  href,
  urgent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  urgent?: boolean;
}) {
  const body = (
    <>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span
        className={`mt-1 block text-[28px] leading-none font-bold -tracking-[0.5px] ${
          urgent && Number(value) > 0 ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </span>
      {hint ? <span className="mt-1.5 block text-[12.5px] text-muted">{hint}</span> : null}
    </>
  );

  const shell = 'rounded-card border border-line-soft bg-surface px-5 py-4';
  return href ? (
    <Link href={href} className={`${shell} block hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** A 14-day bar row, scaled to its own maximum. */
function Trend({ title, data }: { title: string; data: { date: string; count: number }[] }) {
  const recent = data.slice(-14);
  const max = Math.max(1, ...recent.map((d) => d.count));

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {recent.length === 0 ? (
        <p className="py-6 text-sm text-muted">아직 데이터가 없어요.</p>
      ) : (
        <ol className="mt-4 flex h-32 items-end gap-1.5">
          {recent.map((d) => (
            <li key={d.date} className="flex h-full flex-1 flex-col justify-end">
              <span
                title={`${d.date}: ${d.count}`}
                className="block rounded-t-[3px] bg-brand"
                // Inline height because the value is data, not a design choice.
                style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
              />
              <span className="mt-1.5 block text-center text-[10px] text-muted">
                {d.date.slice(-2)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const stats = await apiFetchOrNull<AdminStats>('/admin/stats');

  if (!stats) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
        <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
          통계를 불러오지 못했어요.
        </p>
      </main>
    );
  }

  const queue = stats.pending;

  return (
    <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">대시보드</h1>

      <h2 className="mt-6 text-[15px] font-bold">처리 대기</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="신고" value={queue.reports} href="/admin/reports" urgent />
        <Tile label="학교 인증" value={queue.verify} href="/admin/verify" urgent />
        <Tile label="모임 승인" value={queue.groups} urgent hint="앱에서 처리" />
        <Tile label="업체 승인" value={queue.businesses} urgent hint="앱에서 처리" />
        <Tile label="문의" value={queue.inquiry} urgent hint="앱에서 처리" />
      </div>

      <h2 className="mt-7 text-[15px] font-bold">회원</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="전체" value={stats.users.total} />
        <Tile label="활동" value={stats.users.active} />
        <Tile label="정지" value={stats.users.suspended} />
        <Tile label="차단" value={stats.users.banned} />
        <Tile label="탈퇴" value={stats.users.deleted} />
      </div>

      <h2 className="mt-7 text-[15px] font-bold">활동</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="오늘 접속" value={stats.dau.today} />
        <Tile label="가입 (24h)" value={stats.signups.d1} hint={`7일 ${stats.signups.d7} · 30일 ${stats.signups.d30}`} />
        <Tile label="글 (24h)" value={stats.posts.d1} hint={`7일 ${stats.posts.d7}`} />
        <Tile label="전체 글" value={stats.content.posts} />
        <Tile label="전체 댓글" value={stats.content.comments} />
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <Trend title="최근 가입" data={stats.signupTrend} />
        <Trend title="일별 접속자" data={stats.dau.trend} />
      </div>
    </main>
  );
}
