import type { Metadata } from 'next';
import Link from 'next/link';
import UserSanctionMenu from '@/components/admin/UserSanctionMenu';
import Pagination from '@/components/Pagination';
import { apiFetchOrNull } from '@/lib/api';
import { cityLabel } from '@/lib/boards';
import { timeAgo } from '@/lib/format';
import type { AdminUsersPage } from '@/lib/types';

export const metadata: Metadata = {
  title: '회원 관리',
  robots: { index: false, follow: false },
};

const PER_PAGE = 30;

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'active', label: '활동' },
  { key: 'suspended', label: '정지' },
  { key: 'banned', label: '차단' },
  { key: 'deleted', label: '탈퇴' },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: '운영자',
  student: '학생',
  working_holiday: '워홀',
  general: '일반',
};

const STATUS_TONES: Record<string, { bg: string; fg: string; label: string }> = {
  suspended: { bg: '#FEF3C7', fg: '#B45309', label: '정지' },
  banned: { bg: '#FEE2E2', fg: '#B91C1C', label: '차단' },
  deleted: { bg: '#EDEDF0', fg: '#4A4A4F', label: '탈퇴' },
};

type Props = {
  searchParams: Promise<{ q?: string; status?: string; role?: string; page?: string }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = STATUS_TABS.some((t) => t.key && t.key === sp.status) ? sp.status! : '';
  const role = ROLE_LABELS[sp.role ?? ''] ? sp.role! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (role) query.set('role', role);

  const result = await apiFetchOrNull<AdminUsersPage>(`/admin/users?${query}`);
  const users = result?.users ?? [];

  function hrefWith(overrides: Record<string, string>) {
    const next = new URLSearchParams({ q, status, role, page: String(page), ...overrides });
    for (const [k, v] of [...next.entries()]) {
      if (!v || (k === 'page' && v === '1')) next.delete(k);
    }
    const qs = next.toString();
    return qs ? `/admin/users?${qs}` : '/admin/users';
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">회원 관리</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        전체 {result?.total ?? 0}명. 제재 사유는 회원에게 그대로 보여요.
      </p>

      <form action="/admin/users" className="mt-4 flex h-11 items-center gap-2 rounded-control bg-field px-3.5">
        <label htmlFor="admin-user-q" className="sr-only-label">
          닉네임 또는 이메일 검색
        </label>
        <input
          id="admin-user-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="닉네임 또는 이메일"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {role ? <input type="hidden" name="role" value={role} /> : null}
      </form>

      <nav aria-label="회원 상태" className="mt-3 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const on = t.key === status;
          return (
            <Link
              key={t.key || 'all'}
              href={hrefWith({ status: t.key, page: '1' })}
              aria-current={on ? 'true' : undefined}
              className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {[{ key: '', label: '역할 전체' }, ...Object.entries(ROLE_LABELS).map(([key, label]) => ({ key, label }))].map(
            (r) => {
              const on = r.key === role;
              return (
                <Link
                  key={r.key || 'allroles'}
                  href={hrefWith({ role: r.key, page: '1' })}
                  aria-current={on ? 'true' : undefined}
                  className={`flex h-8 items-center rounded-pill px-3 text-[13px] ${
                    on ? 'bg-brand-tint font-bold text-brand-ink-hover' : 'text-muted hover:bg-field'
                  }`}
                >
                  {r.label}
                </Link>
              );
            }
          )}
        </span>
      </nav>

      {users.length === 0 ? (
        <p className="mt-5 rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
          {q ? '검색 결과가 없어요.' : '해당 조건의 회원이 없어요.'}
        </p>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-card border border-line-soft bg-surface">
          {users.map((user) => {
            const tone = STATUS_TONES[user.status ?? 'active'];
            return (
              <li
                key={user.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-line-faint px-5 py-4 last:border-b-0"
              >
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/users/${user.id}`}
                      target="_blank"
                      prefetch={false}
                      className="text-[15px] font-semibold text-ink hover:underline"
                    >
                      {user.nickname}
                    </Link>
                    <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                    {tone ? (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11.5px] font-bold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {tone.label}
                      </span>
                    ) : null}
                    {user.verified && user.university ? (
                      <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                        {user.university}
                      </span>
                    ) : null}
                    {user.shadowBanned ? (
                      <span className="rounded-md bg-[#EDE9FE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#6D28D9]">
                        쉐도우
                      </span>
                    ) : null}
                    {(user.warningCount ?? 0) > 0 ? (
                      <span className="text-[11.5px] text-muted">경고 {user.warningCount}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] break-all text-muted">
                    {[
                      user.email,
                      cityLabel(user.city) || null,
                      `${timeAgo(user.createdAt)} 가입`,
                      user.suspendedUntil ? `${new Date(user.suspendedUntil).toLocaleDateString('ko-KR')}까지` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                {user.status === 'deleted' ? (
                  <p className="text-[12.5px] text-muted">탈퇴한 계정</p>
                ) : (
                  <UserSanctionMenu user={user} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        total={result?.total ?? 0}
        perPage={PER_PAGE}
        hrefFor={(n) => hrefWith({ page: String(n) })}
      />
    </main>
  );
}
