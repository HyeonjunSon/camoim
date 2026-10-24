import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminLogPage } from '@/lib/types';
import { ADMIN_ACTION_FILTERS, adminActionLabel, summarizeMeta } from '@/lib/adminLog';

export const metadata: Metadata = {
  title: '운영 로그',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ action?: string; page?: string }> };

/**
 * "26.10.24 14:05" in Toronto time, where the team sits. Built from numeric parts:
 * the server's Node lacks Korean locale data (ko-KR printed "PM"), but numbers and
 * time zones are always there.
 */
function when(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

export default async function AdminLogsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const action = ADMIN_ACTION_FILTERS.some((f) => f.key === sp.action) ? sp.action! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  const query = new URLSearchParams({ page: String(page) });
  if (action) query.set('action', action);
  const data = await apiFetchOrNull<AdminLogPage>(`/admin/logs?${query}`);

  const hrefFor = (next: { action?: string; page?: number }) => {
    const q = new URLSearchParams();
    const a = next.action ?? action;
    const p = next.page ?? 1;
    if (a) q.set('action', a);
    if (p > 1) q.set('page', String(p));
    const s = q.toString();
    return s ? `/admin/logs?${s}` : '/admin/logs';
  };

  return (
    <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">운영 로그</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        관리자가 한 조치가 시간순으로 남아요. 시간은 토론토 기준이에요.
      </p>

      <nav aria-label="로그 종류" className="mt-4 flex flex-wrap gap-2">
        {ADMIN_ACTION_FILTERS.map((f) => {
          const on = f.key === action;
          return (
            <Link
              key={f.key || 'all'}
              href={hrefFor({ action: f.key, page: 1 })}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {!data ? (
        <p className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
          로그를 불러오지 못했어요.
        </p>
      ) : data.logs.length === 0 ? (
        <p className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
          기록이 없어요.
        </p>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-muted">전체 {data.total}건</p>
          <ul className="mt-2 overflow-hidden rounded-card border border-line-soft bg-surface">
            {data.logs.map((log) => (
              <li key={log.id} className="border-b border-line-faint px-5 py-3 last:border-b-0 sm:px-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[14.5px] font-semibold">{adminActionLabel(log.action)}</span>
                  <span className="text-[12.5px] text-muted">{log.adminName || '관리자'}</span>
                  <time dateTime={log.createdAt} className="ml-auto text-[12.5px] text-muted tabular-nums">
                    {when(log.createdAt)}
                  </time>
                </div>
                {log.targetType || summarizeMeta(log.meta) ? (
                  <p className="mt-0.5 text-[12.5px] break-all text-ink-3">
                    {[log.targetType && log.targetId ? `${log.targetType} ${log.targetId}` : log.targetType, summarizeMeta(log.meta)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {data.pages > 1 ? (
            <nav aria-label="페이지" className="mt-4 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? (
                <Link href={hrefFor({ page: page - 1 })} className="text-brand-ink hover:text-brand-ink-hover">
                  ‹ 이전
                </Link>
              ) : null}
              <span className="text-muted tabular-nums">
                {page} / {data.pages}
              </span>
              {page < data.pages ? (
                <Link href={hrefFor({ page: page + 1 })} className="text-brand-ink hover:text-brand-ink-hover">
                  다음 ›
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
